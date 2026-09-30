import { Fragment } from "react";
import Link from "next/link";
import {
  getComunicazioni,
  getOrdineMenu,
  getImpostazioni,
  getAssentiOggi,
  getPrenotazioniInCorso,
  listPacchiInAttesa,
} from "@/lib/data";
import { getMeteoOggi } from "@/lib/meteo";
import { brandingDa } from "@/lib/branding";
import { getProssimaVoceCalendario } from "@/lib/calendario";
import { getCurrentUser, canEditComunicazioneItem } from "@/lib/auth";
import { formatData, formatOrarioEvento, mostraInEvidenza } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { SEZIONI_HOME_DEFAULT } from "@/lib/home-sezioni";
import { EditButton } from "@/components/ui/EditButton";
import { ComunicazioneCard } from "@/components/ui/ComunicazioneCard";
import type { Comunicazione } from "@/types";

export const dynamic = "force-dynamic";

// "Adesso" in ora italiana esplicita: il processo Node in produzione gira in UTC
// (vedi project_fix_timezone_orari), quindi new Date().getHours() darebbe l'ora
// UTC, sbagliata di 1-2h rispetto all'Italia. Usata solo per il widget "Riunioni
// in corso" (getPrenotazioniInCorso): data/ora_inizio/ora_fine in DB sono valori
// locali italiani puri, vanno confrontati con l'ora italiana reale, non UTC.
function adessoRoma(): { data: string; ora: string } {
  const now = new Date();
  const data = now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const ora = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return { data, ora };
}

// Home: solo le news, in tre blocchi con ordine/nomi personalizzabili da
// /admin/impostazioni (vedi lib/home-sezioni.ts) — nessun widget statistico nella
// colonna principale. La colonna laterale (riunioni in corso, prossimo evento in
// calendario, assenti oggi) è furniture fissa di pagina, non un blocco
// riordinabile: vedi getAssentiOggi e getPrenotazioniInCorso in lib/data.ts e
// getProssimaVoceCalendario in lib/calendario.ts. Il meteo (lib/meteo.ts) è invece
// nell'header, di fianco al titolo, non nella colonna laterale.
export default async function HomePage() {
  const { data: dataOggi, ora: oraAdesso } = adessoRoma();
  const [ufficiali, nonUfficiali, rsu, sicurezza, eventi, formazione, user, ordineHome, impostazioni, assenti, meteo, riunioniInCorso, pacchiInAttesa, prossimoEvento] =
    await Promise.all([
      getComunicazioni("ufficiale"),
      getComunicazioni("non_ufficiale"),
      getComunicazioni("rsu"),
      getComunicazioni("sicurezza"),
      getComunicazioni("eventi"),
      getComunicazioni("formazione"),
      getCurrentUser(),
      getOrdineMenu("home"),
      getImpostazioni(),
      getAssentiOggi(),
      getImpostazioni().then((imp) => getMeteoOggi(brandingDa(imp).meteo)),
      getPrenotazioniInCorso(dataOggi, oraAdesso),
      listPacchiInAttesa(),
      getProssimaVoceCalendario(dataOggi, oraAdesso),
    ]);

  const sezioni = applicaEtichette(
    ordinaConFallback(SEZIONI_HOME_DEFAULT, (s) => s.chiave, ordineHome),
    (s) => s.chiave,
    "home",
    impostazioni
  );

  const titolo = impostazioni["sito_titolo"] || "Benvenuto nell'Intranet";
  const branding = brandingDa(impostazioni);
  // Sottotitolo non impostato: si mostra il nome dell'ente (/admin/impostazioni).
  const sottotitolo = impostazioni["sito_sottotitolo"] || branding.nome;

  // "In evidenza" promuove la comunicazione nel blocco in cima alla pagina,
  // qualunque sia il tipo (ufficiale, non ufficiale, RSU, sicurezza, eventi o formazione).
  const inEvidenza = [...ufficiali, ...nonUfficiali, ...rsu, ...sicurezza, ...eventi, ...formazione]
    .filter(mostraInEvidenza)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const inEvidenzaIds = new Set(inEvidenza.map((c) => c.id));

  // Le altre comunicazioni ufficiali, in ordine cronologico (già ordinate per data
  // da getComunicazioni), le non ufficiali, le RSU, la sicurezza e gli eventi a
  // parte in fondo alla pagina.
  const cronologiche = ufficiali.filter((c) => !inEvidenzaIds.has(c.id));
  const informali = nonUfficiali.filter((c) => !inEvidenzaIds.has(c.id));
  const rsuAltre = rsu.filter((c) => !inEvidenzaIds.has(c.id));
  const sicurezzaAltre = sicurezza.filter((c) => !inEvidenzaIds.has(c.id));
  const formazioneAltre = formazione.filter((c) => !inEvidenzaIds.has(c.id));

  function cardNews(c: Comunicazione) {
    return (
      <article
        key={c.id}
        className={`card hero-card${user && canEditComunicazioneItem(user, c) ? " has-fab" : ""}`}
      >
        {user && canEditComunicazioneItem(user, c) && (
          <EditButton href={`/admin/comunicazioni?edit=${c.id}`} variant="fab" />
        )}
        <span className="hero-card__label">{c.categoria}</span>
        <h2 className="hero-card__title">
          <Link href={`/comunicazioni/${c.id}`}>{c.titolo}</Link>
        </h2>
        <p className="hero-card__excerpt">{c.estratto}</p>
        <div className="hero-card__meta">
          {c.autore} · {formatData(c.data)}
        </div>
      </article>
    );
  }

  function listaNews(items: Comunicazione[]) {
    return (
      <ul className="comm-list">
        {items.map((c) => (
          <ComunicazioneCard
            key={c.id}
            comunicazione={c}
            editHref={user && canEditComunicazioneItem(user, c) ? `/admin/comunicazioni?edit=${c.id}` : undefined}
          />
        ))}
      </ul>
    );
  }

  function renderSezione(chiave: string, label: string) {
    switch (chiave) {
      case "in-evidenza":
        if (inEvidenza.length === 0) return null;
        return (
          <div className="news-section news-section--evidenza">
            <div className="news-section__label">{label}</div>
            <div className="hero-grid">{inEvidenza.map(cardNews)}</div>
          </div>
        );

      case "cronologiche":
        if (cronologiche.length === 0) return null;
        return (
          <div className="news-section news-section--cronologiche">
            <div className="news-section__label">{label}</div>
            {listaNews(cronologiche.slice(0, 3))}
            <Link href={ROUTES.comunicazioniUfficiali.path} className="news-section__archivio">
              Archivio delle comunicazioni →
            </Link>
          </div>
        );

      case "informali":
        if (informali.length === 0) return null;
        return (
          <div className="news-section news-section--informali">
            <div className="news-section__label">{label}</div>
            {listaNews(informali.slice(0, 3))}
            <Link href={ROUTES.comunicazioniNonUfficiali.path} className="news-section__archivio">
              Archivio delle comunicazioni →
            </Link>
          </div>
        );

      case "rsu":
        // A differenza delle altre sezioni, questa resta sempre visibile (anche
        // senza comunicazioni) invece di sparire quando vuota: RSU deve avere un
        // punto fisso in home, non solo comparire quando c'è qualcosa da mostrare.
        return (
          <div className="news-section news-section--rsu">
            <div className="news-section__label">{label}</div>
            {rsuAltre.length > 0 ? (
              listaNews(rsuAltre.slice(0, 3))
            ) : (
              <p className="help">Nessuna comunicazione RSU al momento.</p>
            )}
            <Link href={ROUTES.comunicazioniRsu.path} className="news-section__archivio">
              Archivio delle comunicazioni →
            </Link>
          </div>
        );

      case "sicurezza":
        if (sicurezzaAltre.length === 0) return null;
        return (
          <div className="news-section news-section--sicurezza">
            <div className="news-section__label">{label}</div>
            {listaNews(sicurezzaAltre.slice(0, 3))}
            <Link href={ROUTES.comunicazioniSicurezza.path} className="news-section__archivio">
              Archivio delle comunicazioni →
            </Link>
          </div>
        );

      case "formazione":
        if (formazioneAltre.length === 0) return null;
        return (
          <div className="news-section news-section--formazione">
            <div className="news-section__label">{label}</div>
            {listaNews(formazioneAltre.slice(0, 3))}
            <Link href={ROUTES.comunicazioniFormazione.path} className="news-section__archivio">
              Archivio delle comunicazioni →
            </Link>
          </div>
        );

      default:
        return null;
    }
  }

  const nessunaNews =
    inEvidenza.length === 0 &&
    cronologiche.length === 0 &&
    informali.length === 0 &&
    rsuAltre.length === 0 &&
    sicurezzaAltre.length === 0 &&
    formazioneAltre.length === 0;

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{titolo}</h1>
            <p>{sottotitolo}</p>
          </div>
          {meteo && (
            <a
              href={branding.meteo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card header-meteo"
              title="Previsioni meteo su 3bmeteo"
            >
              <span className="header-meteo__icon" aria-hidden="true">{meteo.icona}</span>
              <div>
                <div className="header-meteo__temp">{meteo.temperatura}°C</div>
                <div className="header-meteo__desc">{meteo.descrizione}</div>
              </div>
            </a>
          )}
        </div>
      </header>

      {/* Solo qui in home: sulle altre pagine la ricerca torna nella sidebar
          (vedi sidebar__search--glow in Sidebar.tsx) — qui comparirebbe
          doppia. */}
      <form action="/cerca" method="get" className="home-search">
        <span className="home-search__icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          name="q"
          placeholder="Cerca tra comunicazioni, regolamenti, moduli, rubrica…"
          className="home-search__input"
          aria-label="Cerca"
        />
        <button type="submit" className="btn btn--primary home-search__btn">
          Cerca
        </button>
      </form>

      <div className="home-layout">
        <div className="home-main">
          {sezioni.map((s) => (
            <Fragment key={s.chiave}>{renderSezione(s.chiave, s.label)}</Fragment>
          ))}
          {nessunaNews && <div className="card empty">Nessuna comunicazione pubblicata.</div>}
        </div>

        <aside className="home-aside">
          {pacchiInAttesa.length > 0 && (
            <div className="card widget widget-pacchi">
              <div className="widget__title">
                📦 Di chi è questo pacco?
                {pacchiInAttesa.length > 1 && <span className="badge">{pacchiInAttesa.length}</span>}
              </div>
              <ul className="widget-assenti__list">
                {pacchiInAttesa.map((p) => (
                  <li key={p.id} className="widget-assenti__item">
                    <Link href={`/di-chi-e/${p.id}`} className="widget-assenti__nome">
                      {p.mittente || "Mittente non indicato"}
                    </Link>
                    {p.descrizione && <span className="help">{p.descrizione}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Come il widget "Prossimo evento" qui sotto: tutto il riquadro è un
              link, qui verso Prenotazione sale. */}
          <Link href={ROUTES.prenotazioneSale.path} className="card widget widget--link widget-riunioni">
            <div className="widget__title">
              🚪 Riunioni in corso
              {riunioniInCorso.length > 0 && <span className="badge">{riunioniInCorso.length}</span>}
              <span className="widget-link__arrow" aria-hidden="true">→</span>
            </div>
            {riunioniInCorso.length === 0 ? (
              <p className="widget__empty">Nessuna sala occupata al momento.</p>
            ) : (
              <ul className="widget-assenti__list">
                {riunioniInCorso.map((r) => (
                  <li key={r.id} className="widget-assenti__item">
                    <span className="widget-assenti__nome">{r.salaNome}</span>
                    <span className="help">Prenotata da {r.richiedente}</span>
                  </li>
                ))}
              </ul>
            )}
          </Link>

          {/* Prossimo evento in calendario, subito sotto le riunioni in corso: la
              voce arriva già unita dalle due sorgenti (eventi inseriti in
              /calendario ed eventi fissati nelle comunicazioni), vedi
              getProssimaVoceCalendario in lib/calendario.ts. */}
          {/* Tutto il riquadro è un link al Calendario: per questo il titolo
              dell'evento resta testo semplice anche quando viene da una
              comunicazione — un link dentro un link non è markup valido, e la
              comunicazione si raggiunge comunque dalla voce nel calendario. */}
          <Link href={ROUTES.calendario.path} className="card widget widget--link widget-evento">
            <div className="widget__title">
              📅 Prossimo evento
              <span className="widget-link__arrow" aria-hidden="true">→</span>
            </div>
            {prossimoEvento === null ? (
              <p className="widget__empty">Nessun evento in programma.</p>
            ) : (
              <div className="widget-evento__corpo">
                <div className="widget-evento__quando">
                  {formatData(prossimoEvento.data)} ·{" "}
                  {formatOrarioEvento(prossimoEvento.oraInizio, prossimoEvento.oraFine)}
                </div>
                <div className="widget-evento__titolo">{prossimoEvento.titolo}</div>
                {prossimoEvento.luogo && <div className="help">📍 {prossimoEvento.luogo}</div>}
              </div>
            )}
          </Link>

          <Link href={ROUTES.presenze.path} className="card widget widget-link">
            <span>Hai aggiornato le tue presenze?</span>
            <span className="widget-link__arrow" aria-hidden="true">→</span>
          </Link>

          <div className="card widget widget-assenti">
            <div className="widget__title">
              🧑‍💼 Assenze e smart working oggi
              {assenti.length > 0 && <span className="badge">{assenti.length}</span>}
            </div>
            {assenti.length === 0 ? (
              <p className="widget__empty">Nessuna assenza o smart working registrato oggi.</p>
            ) : (
              <ul className="widget-assenti__list">
                {assenti.map((a) => (
                  <li key={a.id} className="widget-assenti__item">
                    <span className="widget-assenti__nome">
                      {a.nome}{" "}
                      <span className={`status status--${a.tipo === "assente" ? "offline" : "smartworking"}`}>
                        {a.tipo === "assente" ? "Assente" : "Smart working"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
