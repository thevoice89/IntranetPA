import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { getOrdineMenu, getImpostazioni, getUfficiConComunicazioniUfficiali, getContatto, getAnagraficaPrivata } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { filtraPubblicati } from "@/lib/pubblicazione-menu";
import { NAV_ITEMS } from "@/lib/routes";

export const dynamic = "force-dynamic";

// Layout del sito pubblico: sidebar + area contenuti. Ordine, nomi e visibilità
// delle voci sono personalizzabili da /admin/menu (vedi lib/ordina-menu.ts,
// lib/etichette-menu.ts e lib/pubblicazione-menu.ts per i rispettivi fallback
// quando l'admin non ha ancora personalizzato nulla).
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [ordine, impostazioni, ufficiComunicazioni, user] = await Promise.all([
    getOrdineMenu("pubblico"),
    getImpostazioni(),
    getUfficiConComunicazioniUfficiali(),
    getCurrentUser(),
  ]);
  // Stesso criterio del saluto in /admin: nome del contatto rubrica collegato
  // se c'è, altrimenti lo username — serve solo a far capire di essere loggati
  // (il sito non lo segnalava in nessun modo prima). Il genere viene da
  // anagrafica_privata (tabella separata da rubrica, vedi getAnagraficaPrivata
  // in lib/data.ts — "U"/"D"/"" come nel file dell'ufficio del personale) e
  // sceglie tra "Benvenuto"/"Benvenuta" in Sidebar.
  const [contattoCollegato, anagraficaCollegata] = user?.contattoId
    ? await Promise.all([getContatto(user.contattoId), getAnagraficaPrivata(user.contattoId)])
    : [null, null];
  const nomeUtente = user ? contattoCollegato?.nome ?? user.username : null;
  const genereUtente = anagraficaCollegata?.genere || null;
  const items = filtraPubblicati(
    applicaEtichette(
      ordinaConFallback(NAV_ITEMS, (r) => r.path, ordine),
      (r) => r.path,
      "pubblico",
      impostazioni
    ),
    (r) => r.path,
    "pubblico",
    impostazioni
  );

  return (
    <div className="shell">
      <MobileNavToggle />
      <Sidebar
        items={items}
        ufficiComunicazioni={ufficiComunicazioni}
        nomeUtente={nomeUtente}
        genereUtente={genereUtente}
      />
      <main className="main">{children}</main>
    </div>
  );
}
