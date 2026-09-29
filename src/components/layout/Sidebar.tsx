"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES, GRUPPO_COMUNICAZIONI_PATHS } from "@/lib/routes";
import type { AppRoute } from "@/lib/routes";
import type { Ufficio } from "@/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { FontSizeControl } from "@/components/layout/FontSizeControl";

// Sidebar di navigazione del sito pubblico, con evidenziazione della voce attiva
// e ricerca rapida. `items` arriva già ordinato dal layout (vedi ordinaConFallback
// in lib/ordina-menu.ts), riordinabile da /admin/menu. Le 5 voci di comunicazione
// (GRUPPO_COMUNICAZIONI_PATHS in lib/routes.ts) sono raccolte sotto un'unica voce
// pieghevole "Comunicazioni"; `ufficiComunicazioni` (da getUfficiConComunicazioniUfficiali)
// alimenta un secondo livello di sottomenu sotto "Comunicazioni Ufficiali", con un
// link per ufficio verso l'archivio filtrato.
export function Sidebar({
  items,
  ufficiComunicazioni,
  nomeUtente,
  genereUtente,
}: {
  items: AppRoute[];
  ufficiComunicazioni: Ufficio[];
  nomeUtente: string | null;
  genereUtente: string | null;
}) {
  const pathname = usePathname();
  // null = nessuna scelta manuale dell'utente: il sottomenu segue la voce attiva.
  // true/false = l'utente ha cliccato la freccetta, la scelta vince finché non
  // la ritocca di nuovo.
  const [espansoManualmente, setEspansoManualmente] = useState<boolean | null>(null);
  // Stesso meccanismo, per il gruppo "Comunicazioni" che raccoglie le 5 voci
  // sottostanti (vedi GRUPPO_COMUNICAZIONI_PATHS in lib/routes.ts).
  const [gruppoComunicazioniAperto, setGruppoComunicazioniAperto] = useState<boolean | null>(
    null
  );

  const vociComunicazioni = items.filter((r) => GRUPPO_COMUNICAZIONI_PATHS.includes(r.path));
  const primoIndiceComunicazioni = items.findIndex((r) =>
    GRUPPO_COMUNICAZIONI_PATHS.includes(r.path)
  );

  const inHome = pathname === ROUTES.home.path;

  return (
    <aside className="sidebar">
      {/* Stemma del Comune (non il vecchio lockup orizzontale con testo,
          vedi logo.png ancora usato in admin): provato prima nel riquadro
          titolo del corpo pagina, tornato qui su richiesta esplicita
          dell'utente. Home e accesso subito sotto: da loggati "Login"
          diventa il saluto già esistente (sidebar__utente prima stava più in
          basso, qui è solo spostato), che apre la dashboard /admin. "Login"
          passa invece la pagina corrente (?next=, vedi lib/ritorno-login.ts):
          dopo l'accesso si torna qui, non in /admin. */}
      <Link href={ROUTES.home.path} className="sidebar__brand sidebar__brand--crest">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stemma.png" alt="Stemma dell'ente" className="sidebar__brand-crest-img" />
      </Link>

      <div className="sidebar__topnav">
        <Link
          href={ROUTES.home.path}
          className={`sidebar__topnav-link${inHome ? " sidebar__topnav-link--active" : ""}`}
        >
          {ROUTES.home.icon} {ROUTES.home.label}
        </Link>
        {nomeUtente ? (
          <Link href="/admin" className="sidebar__topnav-link sidebar__topnav-link--utente">
            {genereUtente === "D" ? "Benvenuta" : "Benvenuto"} {nomeUtente}
            <span className="widget-link__arrow" aria-hidden="true">→</span>
          </Link>
        ) : (
          <Link
            href={`/admin/login?next=${encodeURIComponent(pathname)}`}
            className="sidebar__topnav-link"
          >
            🔑 Login
          </Link>
        )}
      </div>

      {/* La ricerca vive nel corpo della home (vedi home-search in page.tsx,
          subito sotto il riquadro di benvenuto): qui in sidebar comparirebbe
          doppia. Su tutte le altre pagine invece resta qui, con un contorno
          acceso (sidebar__search--glow) per restare visibile senza il
          riquadro dedicato della home. */}
      {!inHome && (
        <form action="/cerca" method="get" className="sidebar__search sidebar__search--glow">
          <input
            type="search"
            name="q"
            placeholder="🔍 Cerca"
            className="input input--search"
            aria-label="Cerca"
            autoFocus={pathname === ROUTES.cerca.path}
          />
        </form>
      )}

      <div className="sidebar__section">Aree</div>
      {items.map((route, indice) => {
        if (GRUPPO_COMUNICAZIONI_PATHS.includes(route.path)) {
          // Le 5 voci di comunicazione vengono rese una sola volta, raggruppate,
          // nella posizione della prima che compare nell'ordine salvato.
          if (indice !== primoIndiceComunicazioni) return null;

          const gruppoAttivo = vociComunicazioni.some((r) => pathname.startsWith(r.path));
          const gruppoAperto = gruppoComunicazioniAperto ?? gruppoAttivo;

          return (
            <div key="comunicazioni" className="nav-item">
              <div className="nav-row">
                <button
                  type="button"
                  className={`nav-link nav-link--gruppo${gruppoAttivo ? " nav-link--active" : ""}`}
                  aria-expanded={gruppoAperto}
                  onClick={() => setGruppoComunicazioniAperto(!gruppoAperto)}
                >
                  <span className="nav-link__icon">📢</span>
                  Comunicazioni
                </button>
                <button
                  type="button"
                  className={`nav-toggle${gruppoAperto ? " nav-toggle--aperto" : ""}`}
                  aria-expanded={gruppoAperto}
                  aria-label={`${gruppoAperto ? "Nascondi" : "Mostra"} comunicazioni`}
                  onClick={() => setGruppoComunicazioniAperto(!gruppoAperto)}
                >
                  ▾
                </button>
              </div>
              {gruppoAperto && (
                <ul className="nav-submenu">
                  {vociComunicazioni.map((r) => {
                    const subAttiva = pathname.startsWith(r.path);
                    const haUffici =
                      r.path === ROUTES.comunicazioniUfficiali.path &&
                      ufficiComunicazioni.length > 0;
                    const ufficiAperti = haUffici && (espansoManualmente ?? subAttiva);

                    return (
                      <li key={r.path}>
                        <div className="nav-row">
                          <Link
                            href={r.path}
                            className={`nav-sublink nav-sublink--voce${subAttiva ? " nav-sublink--active" : ""}`}
                          >
                            <span className="nav-link__icon">{r.icon}</span>
                            {r.label}
                          </Link>
                          {haUffici && (
                            <button
                              type="button"
                              className={`nav-toggle${ufficiAperti ? " nav-toggle--aperto" : ""}`}
                              aria-expanded={ufficiAperti}
                              aria-label={`${ufficiAperti ? "Nascondi" : "Mostra"} uffici`}
                              onClick={() => setEspansoManualmente(!ufficiAperti)}
                            >
                              ▾
                            </button>
                          )}
                        </div>
                        {ufficiAperti && (
                          <ul className="nav-submenu nav-submenu--nidificato">
                            {ufficiComunicazioni.map((u) => (
                              <li key={u.id}>
                                <Link
                                  href={`${r.path}?ufficio=${encodeURIComponent(u.nome)}`}
                                  className="nav-sublink"
                                >
                                  {u.nome}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }

        const active = pathname.startsWith(route.path);

        return (
          <div key={route.path} className="nav-item">
            <div className="nav-row">
              <Link
                href={route.path}
                className={`nav-link${active ? " nav-link--active" : ""}`}
              >
                <span className="nav-link__icon">{route.icon}</span>
                {route.label}
              </Link>
            </div>
          </div>
        );
      })}

      <div className="sidebar__spacer" />

      <FontSizeControl />
      <ThemeToggle />
    </aside>
  );
}
