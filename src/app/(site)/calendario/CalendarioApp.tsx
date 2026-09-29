"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Contatto, Sala, VoceCalendario } from "@/types";
import ContattoField from "@/components/ui/ContattoField";
import { formatOrarioEvento } from "@/lib/format";
import { caricaVociMese, creaEvento, eliminaEvento } from "./actions";

const NOMI_MESE = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const NOMI_GIORNO = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Celle del mese in formato ISO "YYYY-MM-DD" (null = riempimento prima del giorno 1,
// per allineare il primo giorno alla colonna corretta: settimana Lun-Dom). Stessa
// funzione del calendario di Presenze: le date si costruiscono a mano dai numeri,
// mai via toISOString(), che passerebbe da UTC e sposterebbe il giorno.
function celleMese(anno: number, mese: number): (string | null)[] {
  const nGiorni = new Date(anno, mese, 0).getDate();
  const offset = (new Date(anno, mese - 1, 1).getDay() + 6) % 7;
  const celle: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= nGiorni; d++) {
    celle.push(`${anno}-${String(mese).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return celle;
}

// "2026-09-04" -> "venerdì 4 settembre 2026". Data costruita con i componenti
// locali (non da Date.parse della stringa ISO, che sarebbe UTC).
function formatDataEstesa(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

// Massimo di eventi mostrati dentro la cella del giorno: oltre, la cella
// diventerebbe altissima e sbilancerebbe la griglia — il resto si conta in "+N
// altri" e si legge cliccando il giorno.
const MAX_PILL_GIORNO = 2;

// Identificatore di una voce nella pagina: id e origine insieme, perché un evento
// del calendario e una comunicazione possono avere lo stesso id.
function chiaveVoce(v: VoceCalendario): string {
  return `${v.origine}-${v.id}`;
}

// Form "Aggiungi un evento" del giorno selezionato. È un componente a sé perché
// ha uno stato suo (la sala scelta, che nasconde il campo luogo libero): montato
// con key={giorno} dal calendario, cambiando giorno riparte da zero invece di
// conservare le scelte fatte per il giorno precedente.
function FormNuovoEvento({
  giorno,
  contatti,
  sale,
}: {
  giorno: string;
  contatti: Contatto[];
  sale: Sala[];
}) {
  const [salaId, setSalaId] = useState("");

  return (
    <form action={creaEvento} className="form">
      <h3 style={{ fontSize: "0.95rem", marginBottom: "0.9rem" }}>Aggiungi un evento</h3>
      <input type="hidden" name="data" value={giorno} />

      <div className="field">
        <label htmlFor="titolo">Evento</label>
        <input
          id="titolo"
          name="titolo"
          className="input"
          required
          maxLength={200}
          placeholder="Es. Consegna della biblioteca ai cittadini"
        />
      </div>

      <div className="field--row">
        <div className="field">
          <label htmlFor="oraInizio">Ora inizio</label>
          <input id="oraInizio" name="oraInizio" type="time" className="input" />
        </div>
        <div className="field">
          <label htmlFor="oraFine">Ora fine</label>
          <input id="oraFine" name="oraFine" type="time" className="input" />
        </div>
      </div>

      <div className="field--row">
        {sale.length > 0 && (
          <div className="field">
            <label htmlFor="salaId">Sala comunale</label>
            <select
              id="salaId"
              name="salaId"
              className="select"
              value={salaId}
              onChange={(e) => setSalaId(e.target.value)}
            >
              <option value="">Nessuna (indico io il luogo)</option>
              {sale.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="luogo">Luogo</label>
          {/* Con una sala scelta il campo è disabilitato: un input disabilitato non
              viene inviato, e il luogo lo mette il server col nome della sala. */}
          <input
            id="luogo"
            name="luogo"
            className="input"
            maxLength={200}
            disabled={salaId !== ""}
            placeholder={salaId ? "Il luogo è la sala scelta" : "Es. Piazza Municipio"}
          />
        </div>
      </div>
      <p className="help" style={{ marginTop: "-0.6rem" }}>
        Orari e luogo sono facoltativi: senza ora di inizio l&apos;evento vale per
        l&apos;intera giornata. Scegliendo una sala comunale, la sala risulta
        <strong> occupata in Prenotazione sale</strong> per l&apos;orario dell&apos;evento
        (tutta la giornata, 8:00–21:00, se non indichi gli orari): non serve prenotarla a
        parte. Non vale il contrario — le prenotazioni fatte da Prenotazione sale non
        compaiono in questo calendario.
      </p>

      <div className="field">
        <label htmlFor="descrizione">Descrizione (facoltativa)</label>
        <textarea
          id="descrizione"
          name="descrizione"
          className="textarea"
          rows={3}
          placeholder="Qualche riga in più su cosa succede, per chi legge il calendario."
        />
      </div>

      <ContattoField
        contatti={contatti}
        storageKey="calendario:contattoId"
        help="Scegli il tuo nominativo dall'elenco: resta indicato come chi ha inserito l'evento."
      />

      <button type="submit" className="btn btn--primary">Aggiungi al calendario</button>
    </form>
  );
}

// Calendario del mese: si clicca un giorno per vedere cosa c'è in programma e,
// se il giorno non è già passato, per aggiungere un evento. Le voci mostrate
// arrivano da due sorgenti unite lato server (vedi lib/calendario.ts): gli eventi
// inseriti qui e quelli fissati nelle comunicazioni, questi ultimi in sola
// lettura, con il link alla comunicazione di origine.
export default function CalendarioApp({
  anno: annoIniziale,
  mese: meseIniziale,
  vociIniziali,
  contatti,
  sale,
  oggiIso,
  giornoIniziale,
}: {
  anno: number;
  mese: number;
  vociIniziali: VoceCalendario[];
  contatti: Contatto[];
  // Sale prenotabili proposte nel form (vedi listSaleGenerali): scegliendone una
  // l'evento genera anche la prenotazione della sala.
  sale: Sala[];
  oggiIso: string;
  // Giorno da preselezionare al caricamento: dopo un inserimento o
  // un'eliminazione l'azione server rimanda qui con ?giorno=..., così si
  // riapre il pannello del giorno appena toccato invece del mese corrente.
  giornoIniziale: string | null;
}) {
  const [anno, setAnno] = useState(annoIniziale);
  const [mese, setMese] = useState(meseIniziale);
  const [voci, setVoci] = useState(vociIniziali);
  const [giornoSelezionato, setGiornoSelezionato] = useState<string | null>(giornoIniziale);
  // Evento aperto (chiave di chiaveVoce) nel pannello del giorno: cliccando una
  // riga-evento dentro la cella del mese, quell'evento si apre già espanso col
  // testo completo, senza doverlo riaprire una seconda volta nel pannello.
  const [voceAperta, setVoceAperta] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Dopo un inserimento o un'eliminazione il server rimanda a questa stessa
  // pagina: essendo una navigazione client-side il componente NON viene
  // rimontato e lo stato sopravvive, quindi senza risincronizzarlo sui nuovi
  // dati resterebbe a video la situazione precedente alla modifica (stesso
  // inganno dei defaultValue che sopravvivono tra un record e l'altro nei form
  // admin). Le dipendenze sono i valori che il server ricalcola ad ogni
  // risposta: cambiano di identità solo quando arriva davvero un nuovo payload.
  useEffect(() => {
    setAnno(annoIniziale);
    setMese(meseIniziale);
    setVoci(vociIniziali);
    setGiornoSelezionato(giornoIniziale);
    setVoceAperta(null);
  }, [annoIniziale, meseIniziale, vociIniziali, giornoIniziale]);

  // Cambio mese con le frecce: le voci del nuovo mese si chiedono al server.
  // Il mese che il server ha già fornito con la pagina non viene richiesto di
  // nuovo — tornandoci si riusano quelle voci, invece di una seconda query
  // identica ad ogni caricamento.
  useEffect(() => {
    if (anno === annoIniziale && mese === meseIniziale) {
      setVoci(vociIniziali);
      return;
    }
    let annullato = false;
    startTransition(async () => {
      const righe = await caricaVociMese(anno, mese);
      if (!annullato) setVoci(righe);
    });
    return () => {
      annullato = true;
    };
  }, [anno, mese, annoIniziale, meseIniziale, vociIniziali]);

  function vaiMese(delta: number) {
    let nm = mese + delta;
    let na = anno;
    if (nm < 1) { nm = 12; na -= 1; }
    if (nm > 12) { nm = 1; na += 1; }
    setAnno(na);
    setMese(nm);
    setGiornoSelezionato(null);
    setVoceAperta(null);
  }

  function vaiOggi() {
    setAnno(Number(oggiIso.slice(0, 4)));
    setMese(Number(oggiIso.slice(5, 7)));
    setGiornoSelezionato(oggiIso);
    setVoceAperta(null);
  }

  // Click sulla cella: apre il pannello del giorno con tutti gli eventi chiusi.
  function apriGiorno(iso: string) {
    setGiornoSelezionato(iso);
    setVoceAperta(null);
  }

  // Click su una riga-evento dentro la cella: apre il pannello di quel giorno
  // già con quell'evento espanso.
  function apriVoce(iso: string, v: VoceCalendario) {
    setGiornoSelezionato(iso);
    setVoceAperta(chiaveVoce(v));
  }

  const celle = celleMese(anno, mese);
  // Voci indicizzate per giorno: la griglia le cerca una volta per cella.
  const vociPerGiorno = useMemo(() => {
    const mappa = new Map<string, VoceCalendario[]>();
    for (const v of voci) {
      const giorno = mappa.get(v.data);
      if (giorno) giorno.push(v);
      else mappa.set(v.data, [v]);
    }
    return mappa;
  }, [voci]);
  const vociDelGiorno = giornoSelezionato ? vociPerGiorno.get(giornoSelezionato) ?? [] : [];
  const giornoPassato = giornoSelezionato !== null && giornoSelezionato < oggiIso;

  return (
    <>
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="calendar__head">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => vaiMese(-1)} aria-label="Mese precedente">
            ‹
          </button>
          <div className="calendar__title">{NOMI_MESE[mese - 1]} {anno}</div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => vaiMese(1)} aria-label="Mese successivo">
            ›
          </button>
        </div>

        <div className="cal-barra">
          <button type="button" className="btn btn--ghost btn--sm" onClick={vaiOggi}>
            Oggi
          </button>
          <div className="cal-legenda">
            <span className="cal-legenda__voce">
              <span className="cal-pill cal-pill--evento cal-pill--campione" /> Eventi del calendario
            </span>
            <span className="cal-legenda__voce">
              <span className="cal-pill cal-pill--comunicazione cal-pill--campione" /> Eventi dalle comunicazioni
            </span>
          </div>
        </div>

        <div className="calendar__grid calendar__grid--head">
          {NOMI_GIORNO.map((g) => (
            <div key={g} className="calendar__weekday">{g}</div>
          ))}
        </div>
        <div className="calendar__grid">
          {celle.map((iso, i) => {
            if (iso === null) {
              return <div key={`vuoto-${i}`} className="cal-giorno cal-giorno--vuoto" />;
            }
            const vociGiorno = vociPerGiorno.get(iso) ?? [];
            const classi = [
              "cal-giorno",
              iso === oggiIso ? "cal-giorno--oggi" : "",
              iso === giornoSelezionato ? "cal-giorno--selezionato" : "",
              iso < oggiIso ? "cal-giorno--passato" : "",
            ]
              .filter(Boolean)
              .join(" ");
            // La cella non è più un <button>: le righe-evento al suo interno sono
            // a loro volta cliccabili (aprono quel singolo evento) e un bottone
            // dentro un bottone non è markup valido. Resta un elemento a tutti
            // gli effetti azionabile, anche da tastiera (Invio/Spazio).
            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                className={classi}
                onClick={() => apriGiorno(iso)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    apriGiorno(iso);
                  }
                }}
                title={
                  vociGiorno.length === 0
                    ? `${formatDataEstesa(iso)}: nessun evento`
                    : `${formatDataEstesa(iso)}: ${vociGiorno.length} event${vociGiorno.length === 1 ? "o" : "i"}`
                }
              >
                <span className="cal-giorno__num">{Number(iso.slice(-2))}</span>
                {vociGiorno.slice(0, MAX_PILL_GIORNO).map((v) => (
                  <button
                    key={chiaveVoce(v)}
                    type="button"
                    className={`cal-pill cal-pill--${v.origine === "comunicazione" ? "comunicazione" : "evento"}`}
                    // stopPropagation: senza, scatterebbe anche il click sulla
                    // cella, che azzera l'evento aperto e lo lascerebbe chiuso.
                    onClick={(e) => {
                      e.stopPropagation();
                      apriVoce(iso, v);
                    }}
                    title={`${v.titolo}: clicca per leggere i dettagli`}
                  >
                    {v.oraInizio ? `${v.oraInizio} ` : ""}
                    {v.titolo}
                  </button>
                ))}
                {vociGiorno.length > MAX_PILL_GIORNO && (
                  <span className="cal-giorno__altri">
                    +{vociGiorno.length - MAX_PILL_GIORNO} altri
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {giornoSelezionato === null ? (
        <div className="card empty">
          Clicca un giorno del calendario per vedere gli eventi in programma e aggiungerne uno.
        </div>
      ) : (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
            {formatDataEstesa(giornoSelezionato)}
          </h2>

          {vociDelGiorno.length === 0 ? (
            <p className="help" style={{ marginBottom: "1.4rem" }}>
              Nessun evento in programma in questa giornata.
            </p>
          ) : (
            <ul className="admin-list" style={{ marginBottom: "1.4rem" }}>
              {vociDelGiorno.map((v) => {
                const chiave = chiaveVoce(v);
                // Intestazione sempre visibile. Il titolo resta testo semplice
                // anche per le voci che arrivano da una comunicazione: cliccare
                // l'evento deve espanderlo, non portare via dalla pagina — il
                // link alla comunicazione sta nella parte espansa.
                const intestazione = (
                  <>
                    <div className="admin-row__title">
                      {formatOrarioEvento(v.oraInizio, v.oraFine)} · {v.titolo}
                    </div>
                    {v.luogo && (
                      <div className="admin-row__sub">
                        📍 {v.luogo}
                        {v.salaPrenotata && " · sala prenotata"}
                      </div>
                    )}
                    {v.dettaglio && <div className="admin-row__sub">{v.dettaglio}</div>}
                    <div className="admin-row__sub">
                      {v.origine === "comunicazione" ? (
                        <>Dalla comunicazione di {v.autore}</>
                      ) : (
                        <>Inserito da {v.autore}</>
                      )}
                    </div>
                  </>
                );
                // Senza descrizione e senza comunicazione collegata non c'è nulla
                // da mostrare in più: la riga resta piatta, invece di offrire un
                // "espandi" che aprirebbe il vuoto.
                const espandibile = Boolean(v.dettaglio || v.href);
                return (
                  <li key={chiave} className="card admin-row">
                    <div className="admin-row__main">
                      {espandibile ? (
                        <details
                          open={voceAperta === chiave}
                          // Aprendo un altro evento React chiude questo, che
                          // rilancia onToggle: azzerare lo stato solo se è ancora
                          // questa la voce aperta, altrimenti si richiuderebbe
                          // subito quella appena aperta.
                          onToggle={(e) => {
                            const aperto = e.currentTarget.open;
                            setVoceAperta((prec) =>
                              aperto ? chiave : prec === chiave ? null : prec
                            );
                          }}
                        >
                          <summary className="cal-evento__sommario">{intestazione}</summary>
                          <div className="cal-evento__dettaglio">
                            {v.dettaglio && <p className="cal-evento__testo">{v.dettaglio}</p>}
                            {v.href && (
                              <Link href={v.href} className="btn btn--ghost btn--sm">
                                Apri la comunicazione
                              </Link>
                            )}
                          </div>
                        </details>
                      ) : (
                        intestazione
                      )}
                    </div>
                    {v.origine === "calendario" ? (
                      <form action={eliminaEvento} className="inline-form">
                        <input type="hidden" name="id" value={v.id} />
                        <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                      </form>
                    ) : (
                      <span className="chip">Comunicazione</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {giornoPassato ? (
            <p className="help">
              Giornata già passata: gli eventi si possono aggiungere solo da oggi in avanti.
            </p>
          ) : (
            // key sul giorno: cambiando giorno il form si rimonta svuotato, invece
            // di conservare i valori digitati per il giorno precedente (vedi il
            // problema noto dei defaultValue che sopravvivono alla navigazione
            // client-side).
            <FormNuovoEvento
              key={giornoSelezionato}
              giorno={giornoSelezionato}
              contatti={contatti}
              sale={sale}
            />
          )}
        </div>
      )}
    </>
  );
}
