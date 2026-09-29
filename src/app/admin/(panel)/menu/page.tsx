import { requireAdmin, canManageAnyUfficio, canManageSondaggi } from "@/lib/auth";
import {
  countSegnalazioniNonLette,
  countCompilazioniNonLette,
  countCompilazioniSondaggiNonLette,
  countPacchiInAttesa,
  getOrdineMenu,
  getImpostazioni,
} from "@/lib/data";
import { buildAdminMenuItems } from "@/lib/admin-menu";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { applicaPubblicazione } from "@/lib/pubblicazione-menu";
import { NAV_ITEMS } from "@/lib/routes";
import MenuSortableList from "./MenuSortableList";

export const dynamic = "force-dynamic";

// Riordino e rinomina dei due menu (solo admin): l'elenco delle voci admin è sempre
// completo (buildAdminMenuItems riceve il contesto dell'utente corrente, che essendo
// admin ha per costruzione tutti i flag di visibilità veri — vedi lib/admin-menu.ts).
export default async function AdminMenu() {
  const user = await requireAdmin();
  const gestisceModuli = canManageAnyUfficio(user);
  const gestisceSondaggi = canManageSondaggi(user);
  const [
    segnalazioniNonLette,
    compilazioniNonLette,
    compilazioniSondaggiNonLette,
    pacchiInAttesa,
    ordinePubblico,
    ordineAdmin,
    impostazioni,
  ] = await Promise.all([
    countSegnalazioniNonLette(),
    gestisceModuli ? countCompilazioniNonLette(null) : Promise.resolve(0),
    gestisceSondaggi ? countCompilazioniSondaggiNonLette() : Promise.resolve(0),
    countPacchiInAttesa(),
    getOrdineMenu("pubblico"),
    getOrdineMenu("admin"),
    getImpostazioni(),
  ]);

  const vociPubblico = applicaPubblicazione(
    applicaEtichette(
      ordinaConFallback(NAV_ITEMS, (r) => r.path, ordinePubblico).map((r) => ({
        chiave: r.path,
        label: r.label,
        icon: r.icon,
      })),
      (v) => v.chiave,
      "pubblico",
      impostazioni
    ),
    (v) => v.chiave,
    "pubblico",
    impostazioni
  );

  const adminItems = buildAdminMenuItems({
    user,
    segnalazioniNonLette,
    compilazioniNonLette,
    gestisceModuli,
    gestisceSondaggi,
    compilazioniSondaggiNonLette,
    pacchiInAttesa,
    gestiscePresenzeTeam: true,
  });
  const vociAdmin = applicaEtichette(
    ordinaConFallback(adminItems, (i) => i.href, ordineAdmin).map((i) => ({
      chiave: i.href,
      label: i.label,
      icon: i.icon,
    })),
    (v) => v.chiave,
    "admin",
    impostazioni
  );

  return (
    <section>
      <header className="page-header">
        <h1>Menu</h1>
        <p>
          Trascina le voci per riordinarle, clicca sul nome per rinominarle. Nel menu
          pubblico puoi anche nasconderle dal sito senza eliminarle.
        </p>
      </header>

      <h2 className="section-title">Menu pubblico (sito)</h2>
      <MenuSortableList menu="pubblico" voci={vociPubblico} conPubblicazione />

      <h2 className="section-title" style={{ marginTop: "2rem" }}>
        Menu amministrazione
      </h2>
      <MenuSortableList menu="admin" voci={vociAdmin} />
    </section>
  );
}
