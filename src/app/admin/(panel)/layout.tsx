import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import {
  requireUser,
  canManageAnyUfficio,
  canManageSondaggi,
  canManagePacchi,
} from "@/lib/auth";
import {
  countSegnalazioniNonLette,
  countCompilazioniNonLette,
  countCompilazioniSondaggiNonLette,
  countPacchiInAttesa,
  listUffici,
  getOrdineMenu,
  getImpostazioni,
  getContatto,
} from "@/lib/data";
import { espandiConDiscendenti } from "@/lib/uffici-tree";
import { sottopostiDi } from "@/lib/gerarchia";
import { buildAdminMenuItems } from "@/lib/admin-menu";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { logoutAction } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { FontSizeControl } from "@/components/layout/FontSizeControl";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";

export const dynamic = "force-dynamic";

// Layout protetto: guard di autenticazione + chrome dell'area admin,
// con voci di menu in base al ruolo/permessi dell'utente, riordinabili da
// /admin/menu (vedi lib/admin-menu.ts per la logica di visibilità/badge).
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const isAdmin = user.ruolo === "admin";
  const segnalazioniNonLette = await countSegnalazioniNonLette();
  const gestisceModuli = canManageAnyUfficio(user);
  const compilazioniNonLette = gestisceModuli
    ? await countCompilazioniNonLette(
        isAdmin ? null : espandiConDiscendenti(user.uffici, await listUffici())
      )
    : 0;
  const gestisceSondaggi = canManageSondaggi(user);
  const compilazioniSondaggiNonLette = gestisceSondaggi
    ? await countCompilazioniSondaggiNonLette()
    : 0;
  const pacchiInAttesa = canManagePacchi(user) ? await countPacchiInAttesa() : 0;
  // Apre /admin/presenze chi ha il permesso piatto, l'admin, o chi risulta
  // responsabile (anche indiretto) di almeno un collega — vedi lib/gerarchia.ts.
  let gestiscePresenzeTeam = isAdmin;
  if (!gestiscePresenzeTeam && user.contattoId) {
    const eResponsabile = (await sottopostiDi(user.contattoId)).length > 0;
    gestiscePresenzeTeam = gestiscePresenzeTeam || eResponsabile;
  }
  const contattoCollegato = user.contattoId ? await getContatto(user.contattoId) : null;
  const nomeVisualizzato = contattoCollegato?.nome ?? user.username;
  const [ordineMenu, impostazioni] = await Promise.all([
    getOrdineMenu("admin"),
    getImpostazioni(),
  ]);
  const voci = applicaEtichette(
    ordinaConFallback(
      buildAdminMenuItems({
        user,
        segnalazioniNonLette,
        compilazioniNonLette,
        gestisceModuli,
        gestisceSondaggi,
        compilazioniSondaggiNonLette,
        pacchiInAttesa,
        gestiscePresenzeTeam,
      }),
      (v) => v.href,
      ordineMenu
    ),
    (v) => v.href,
    "admin",
    impostazioni
  );

  return (
    <div className="shell">
      <MobileNavToggle />
      <aside className="sidebar">
        <Link href="/" className="sidebar__brand sidebar__brand--crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stemma.png" alt="Stemma dell'ente" className="sidebar__brand-crest-img" />
          <span className="sidebar__brand-caption">Pagina personale</span>
        </Link>

        <div className="sidebar__topnav">
          <Link href={ROUTES.home.path} className="sidebar__topnav-link">
            {ROUTES.home.icon} {ROUTES.home.label}
          </Link>
        </div>

        <div className="sidebar__section">Gestione</div>
        {voci.map((v) => (
          <Link key={v.href} href={v.href} className="nav-link">
            <span className="nav-link__icon">{v.icon}</span>
            {v.label}
            {!!v.badge && v.badge > 0 && <span className="nav-badge">{v.badge}</span>}
          </Link>
        ))}

        <div className="sidebar__spacer" />

        <FontSizeControl />
        <ThemeToggle />

        <div className="user-meta">
          <div className="user-meta__name">{nomeVisualizzato}</div>
          <div className="user-meta__role">{user.ruolo}</div>
        </div>
        <Link href="/admin/password" className="nav-link">
          <span className="nav-link__icon">🔑</span>Cambia password
        </Link>
        <Link href="/" className="nav-link">
          <span className="nav-link__icon">↩︎</span>Torna al sito
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="nav-link"
            style={{ width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}
          >
            <span className="nav-link__icon">⎋</span>Esci
          </button>
        </form>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
