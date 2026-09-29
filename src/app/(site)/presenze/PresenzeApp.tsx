"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Contatto, StatoPresenza, Ufficio } from "@/types";
import { ramoDi } from "@/lib/uffici-tree";
import { SelettorePersona } from "@/components/ui/SelettorePersona";
import { SelettoreData } from "@/components/ui/SelettoreData";
import { caricaMieAssenze, impostaMiaPresenza, caricaAssentiInData, caricaAssentiInPeriodo } from "./actions";

// Ogni clic fa avanzare il ciclo, indipendentemente dalla velocità tra un clic
// e l'altro: libero -> assente (rosso) -> smart working (arancione) -> libero.
function prossimoStato(attuale: StatoPresenza | null): StatoPresenza | null {
  if (attuale === null) return "assente";
  if (attuale === "assente") return "smartworking";
  return null;
}

function labelStato(stato: StatoPresenza | null): string {
  if (stato === "assente") return "Assente";
  if (stato === "smartworking") return "Smart working";
  return "Presente";
}

function statusClass(stato: StatoPresenza | null): string {
  if (stato === "assente") return "offline";
  if (stato === "smartworking") return "smartworking";
  return "attivo";
}

const NOMI_MESE = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const NOMI_GIORNO = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Celle del mese in formato ISO "YYYY-MM-DD" (null = riempimento prima del giorno 1,
// per allineare il primo giorno alla colonna corretta: settimana Lun-Dom).
function celleMese(anno: number, mese: number): (string | null)[] {
  const nGiorni = new Date(anno, mese, 0).getDate();
  const offset = (new Date(anno, mese - 1, 1).getDay() + 6) % 7;
  const celle: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= nGiorni; d++) {
    celle.push(`${anno}-${String(mese).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return celle;
}

function formatDataBreve(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${NOMI_MESE[m - 1]}`;
}

// Massimo numero di giorni interrogabili in un colpo solo dal filtro "per
// periodo" (tabella persone × giorni): oltre, la tabella diventerebbe
// illeggibile e la query pesante, meglio invitare a restringere l'intervallo.
const MAX_GIORNI_PERIODO = 92;

// Elenco date ISO comprese tra inizio e fine (estremi inclusi), calcolate in
// locale come celleMese per evitare le insidie dei fusi orari con Date.parse.
function giorniPeriodo(inizio: string, fine: string): string[] {
  const [ai, mi, di] = inizio.split("-").map(Number);
  const [af, mf, df] = fine.split("-").map(Number);
  const cursor = new Date(ai, mi - 1, di);
  const fineDate = new Date(af, mf - 1, df);
  const giorni: string[] = [];
  while (cursor <= fineDate && giorni.length <= MAX_GIORNI_PERIODO) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    giorni.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return giorni;
}

// Intestazione colonna della tabella periodo: iniziale del giorno della
// settimana sopra il numero del giorno.
function formatGiornoColonna(iso: string): { giorno: number; settimana: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return { giorno: d, settimana: NOMI_GIORNO[idx][0] };
}

function dotClass(stato: StatoPresenza | null): string {
  if (stato === "assente") return "presenza-dot--assente";
  if (stato === "smartworking") return "presenza-dot--smartworking";
  return "presenza-dot--presente";
}

// Ricerca a comparsa sull'albero uffici (Area/Settore/Ufficio): stesso
// comportamento di SelettorePersona (ora in components/ui, condiviso anche col
// nominativo obbligatorio del form Segnalazioni) ma sui nodi dell'organigramma, usata per
// filtrare le presenze per ufficio anziché per singolo nominativo.
function SelettoreUfficio({
  id,
  uffici,
  selezionato,
  onSeleziona,
  placeholder,
}: {
  id: string;
  uffici: Ufficio[];
  selezionato: Ufficio | null;
  onSeleziona: (u: Ufficio | null) => void;
  placeholder: string;
}) {
  const [testo, setTesto] = useState(selezionato?.nome ?? "");
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (selezionato) setTesto(selezionato.nome);
  }, [selezionato]);

  const filtrati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    if (!q) return [];
    return uffici.filter((u) => u.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [testo, uffici]);

  return (
    <div className="autocomplete">
      <input
        id={id}
        className="input"
        value={testo}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setTesto(e.target.value);
          setAperto(true);
          if (selezionato) onSeleziona(null);
        }}
        onFocus={() => setAperto(true)}
        onBlur={() => setAperto(false)}
      />
      {aperto && filtrati.length > 0 && (
        <ul className="autocomplete__list">
          {filtrati.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className={`autocomplete__item picker-opt--${u.livello}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTesto(u.nome);
                  onSeleziona(u);
                  setAperto(false);
                }}
              >
                {u.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "È presente?": lookup istantaneo per il giorno odierno (l'insieme degli assenti
// arriva già pronto dal server, nessuna chiamata di rete, e viene aggiornato in
// locale quando "Le mie assenze" tocca il giorno odierno). Scegliendo una data
// diversa dal filtro, l'insieme per quel giorno viene richiesto al server.
function OggiPresente({
  contatti,
  uffici,
  assentiOggi,
  oggiIso,
}: {
  contatti: Contatto[];
  uffici: Ufficio[];
  assentiOggi: Map<string, StatoPresenza>;
  oggiIso: string;
}) {
  const [selezionato, setSelezionato] = useState<Contatto | null>(null);
  const [ufficio, setUfficio] = useState<Ufficio | null>(null);
  const [dataInizio, setDataInizio] = useState(oggiIso);
  const [dataFine, setDataFine] = useState(oggiIso);
  const [assentiData, setAssentiData] = useState<Map<string, StatoPresenza>>(assentiOggi);
  const [assentiPeriodo, setAssentiPeriodo] = useState<Map<string, Map<string, StatoPresenza>>>(new Map());

  const periodoAttivo = dataInizio !== dataFine;

  // Giorno singolo: stesso comportamento di prima (l'insieme di oggi arriva
  // già pronto dal server, una data diversa viene richiesta al volo).
  useEffect(() => {
    if (periodoAttivo) return;
    if (dataInizio === oggiIso) {
      setAssentiData(assentiOggi);
      return;
    }
    let annullato = false;
    caricaAssentiInData(dataInizio)
      .then((righe) => {
        if (!annullato) setAssentiData(new Map(righe.map((r) => [r.id, r.tipo])));
      })
      .catch(() => {
        // richiesta fallita: lascia lo stato precedente invece di un errore non gestito.
      });
    return () => {
      annullato = true;
    };
  }, [periodoAttivo, dataInizio, oggiIso, assentiOggi]);

  // Periodo: un'unica richiesta per tutto l'intervallo, poi indicizzata per
  // persona e giorno per popolare la tabella.
  useEffect(() => {
    if (!periodoAttivo) return;
    if (giorniPeriodo(dataInizio, dataFine).length > MAX_GIORNI_PERIODO) {
      setAssentiPeriodo(new Map());
      return;
    }
    let annullato = false;
    caricaAssentiInPeriodo(dataInizio, dataFine)
      .then((righe) => {
        if (annullato) return;
        const mappa = new Map<string, Map<string, StatoPresenza>>();
        for (const r of righe) {
          if (!mappa.has(r.id)) mappa.set(r.id, new Map());
          mappa.get(r.id)!.set(r.data, r.tipo);
        }
        setAssentiPeriodo(mappa);
      })
      .catch(() => {
        // richiesta fallita: lascia lo stato precedente invece di un errore non gestito.
      });
    return () => {
      annullato = true;
    };
  }, [periodoAttivo, dataInizio, dataFine]);

  const stato = selezionato ? assentiData.get(selezionato.id) ?? null : null;
  const giorni = periodoAttivo ? giorniPeriodo(dataInizio, dataFine) : [];

  // Nodo scelto più discendenti e antenati: un contatto assegnato a un Ufficio
  // deve comparire anche filtrando per il Settore o l'Area che lo contiene, e
  // viceversa il responsabile di un Settore/Area compare anche cercando un suo
  // Ufficio (appartiene automaticamente anche agli uffici sottostanti).
  const persone = useMemo(() => {
    if (!ufficio) return [];
    const ids = new Set(ramoDi(ufficio.id, uffici));
    return contatti
      .filter((c) => c.uffici.some((u) => ids.has(u.id)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [ufficio, uffici, contatti]);
  const assentiInUfficio = persone.filter((c) => assentiData.get(c.id) === "assente").length;
  const smartInUfficio = persone.filter((c) => assentiData.get(c.id) === "smartworking").length;
  const personeTabella = ufficio ? persone : selezionato ? [selezionato] : [];

  return (
    <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>E&apos; presente?</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="cerca-oggi">Per nominativo</label>
          <SelettorePersona
            id="cerca-oggi"
            contatti={contatti}
            selezionato={selezionato}
            onSeleziona={(c) => {
              setSelezionato(c);
              if (c) setUfficio(null);
            }}
            placeholder="Cerca un nominativo…"
          />
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="cerca-oggi-ufficio">Oppure per ufficio</label>
          <SelettoreUfficio
            id="cerca-oggi-ufficio"
            uffici={uffici}
            selezionato={ufficio}
            onSeleziona={(u) => {
              setUfficio(u);
              if (u) setSelezionato(null);
            }}
            placeholder="Cerca Area, Settore o Ufficio…"
          />
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="cerca-oggi-data-inizio">Dal</label>
          <SelettoreData
            id="cerca-oggi-data-inizio"
            value={dataInizio}
            oggiIso={oggiIso}
            onSeleziona={(iso) => {
              setDataInizio(iso);
              if (iso > dataFine) setDataFine(iso);
            }}
          />
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="cerca-oggi-data-fine">Al</label>
          <SelettoreData
            id="cerca-oggi-data-fine"
            value={dataFine}
            oggiIso={oggiIso}
            onSeleziona={(iso) => setDataFine(iso < dataInizio ? dataInizio : iso)}
          />
        </div>
      </div>

      {selezionato && !periodoAttivo && (
        <p style={{ marginTop: "1.1rem" }}>
          <span className={`status status--${statusClass(stato)}`}>
            {labelStato(stato)}
          </span>{" "}
          <strong>{selezionato.nome}</strong>
          {selezionato.uffici.length > 0 && (
            <span className="help"> · {selezionato.uffici.map((u) => u.nome).join(", ")}</span>
          )}
          {dataInizio !== oggiIso && <span className="help"> · {formatDataBreve(dataInizio)}</span>}
        </p>
      )}

      {ufficio && !periodoAttivo && (
        <div style={{ marginTop: "1.1rem" }}>
          {persone.length === 0 ? (
            <p className="help">Nessun nominativo in rubrica per {ufficio.nome}.</p>
          ) : (
            <>
              <p className="help" style={{ marginBottom: "0.6rem" }}>
                {ufficio.nome} · {assentiInUfficio} assent{assentiInUfficio === 1 ? "e" : "i"}
                {smartInUfficio > 0 && `, ${smartInUfficio} in smart working`} su{" "}
                {persone.length}
                {dataInizio !== oggiIso && ` · ${formatDataBreve(dataInizio)}`}
              </p>
              <ul className="admin-list">
                {persone.map((c) => {
                  const statoOra = assentiData.get(c.id) ?? null;
                  return (
                    <li key={c.id} className="card admin-row">
                      <span className={`status status--${statusClass(statoOra)}`}>
                        {labelStato(statoOra)}
                      </span>
                      <div className="admin-row__main">
                        <div className="admin-row__title">{c.nome}</div>
                        {c.uffici.length > 0 && (
                          <div className="admin-row__sub">{c.uffici.map((u) => u.nome).join(", ")}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {(selezionato || ufficio) && periodoAttivo && (
        <div style={{ marginTop: "1.1rem" }}>
          {giorni.length > MAX_GIORNI_PERIODO ? (
            <p className="help">
              Intervallo troppo ampio: riduci il periodo (massimo {MAX_GIORNI_PERIODO} giorni).
            </p>
          ) : personeTabella.length === 0 ? (
            <p className="help">Nessun nominativo in rubrica per {ufficio?.nome}.</p>
          ) : (
            <>
              <p className="help" style={{ marginBottom: "0.6rem" }}>
                {ufficio ? ufficio.nome : selezionato?.nome} · {formatDataBreve(dataInizio)} – {formatDataBreve(dataFine)}
              </p>
              <div className="presenza-tabella-wrap">
                <table className="presenza-tabella">
                  <thead>
                    <tr>
                      <th className="presenza-tabella__nome" />
                      {giorni.map((iso) => {
                        const { giorno, settimana } = formatGiornoColonna(iso);
                        return (
                          <th key={iso}>
                            <div className="presenza-tabella__settimana">{settimana}</div>
                            {giorno}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {personeTabella.map((c) => (
                      <tr key={c.id}>
                        <td className="presenza-tabella__nome">{c.nome}</td>
                        {giorni.map((iso) => {
                          const statoGiorno = assentiPeriodo.get(c.id)?.get(iso) ?? null;
                          return (
                            <td key={iso} title={`${formatDataBreve(iso)} · ${labelStato(statoGiorno)}`}>
                              <span className={`presenza-dot ${dotClass(statoGiorno)}`} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PresenzeApp({
  contatti,
  uffici,
  anno: annoIniziale,
  mese: meseIniziale,
  assentiOggiIniziali,
  oggiIso,
}: {
  contatti: Contatto[];
  uffici: Ufficio[];
  anno: number;
  mese: number;
  assentiOggiIniziali: { id: string; tipo: StatoPresenza }[];
  oggiIso: string;
}) {
  const [me, setMe] = useState<Contatto | null>(null);
  const [anno, setAnno] = useState(annoIniziale);
  const [mese, setMese] = useState(meseIniziale);
  const [mieGiorni, setMieGiorni] = useState<Map<string, StatoPresenza>>(new Map());
  const [assentiOggi, setAssentiOggi] = useState<Map<string, StatoPresenza>>(
    new Map(assentiOggiIniziali.map((a) => [a.id, a.tipo]))
  );
  const [errore, setErrore] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Recupera chi sono dal browser: nessun login, evita di dover ricercare il
  // proprio nominativo ad ogni visita.
  useEffect(() => {
    try {
      const id = localStorage.getItem("presenze:contattoId");
      if (id) {
        const trovato = contatti.find((c) => c.id === id);
        if (trovato) setMe(trovato);
      }
    } catch {
      // storage non disponibile: ignora, si ricerca ogni volta.
    }
  }, [contatti]);

  useEffect(() => {
    try {
      if (me) localStorage.setItem("presenze:contattoId", me.id);
    } catch {
      // ignora
    }
  }, [me]);

  // Le assenze/smartworking di "me" per il mese visualizzato.
  useEffect(() => {
    if (!me) {
      setMieGiorni(new Map());
      return;
    }
    let annullato = false;
    startTransition(async () => {
      const giorni = await caricaMieAssenze(me.id, anno, mese);
      if (!annullato) setMieGiorni(new Map(giorni.map((g) => [g.data, g.tipo])));
    });
    return () => {
      annullato = true;
    };
  }, [me, anno, mese]);

  function vaiMese(delta: number) {
    setErrore(null);
    let nm = mese + delta;
    let na = anno;
    if (nm < 1) { nm = 12; na -= 1; }
    if (nm > 12) { nm = 1; na += 1; }
    setAnno(na);
    setMese(nm);
  }

  function handleClick(iso: string) {
    if (!me) {
      setErrore("Cerca e seleziona il tuo nominativo per registrare un'assenza o uno smart working.");
      return;
    }
    setErrore(null);
    const contattoId = me.id;
    const statoPrecedente = mieGiorni.get(iso) ?? null;
    const nuovoStato = prossimoStato(statoPrecedente);

    // Applica localmente lo stato (calendario personale + eventualmente il
    // lookup "È presente?" se il giorno toccato è proprio oggi).
    function applica(stato: StatoPresenza | null) {
      setMieGiorni((prev) => {
        const next = new Map(prev);
        if (stato) next.set(iso, stato); else next.delete(iso);
        return next;
      });
      if (iso === oggiIso) {
        setAssentiOggi((prev) => {
          const next = new Map(prev);
          if (stato) next.set(contattoId, stato); else next.delete(contattoId);
          return next;
        });
      }
    }

    applica(nuovoStato); // ottimistico
    startTransition(async () => {
      const res = await impostaMiaPresenza(contattoId, iso, nuovoStato);
      if ("errore" in res) {
        setErrore(res.errore);
        applica(statoPrecedente); // il server non ha applicato la modifica: ripristina
        return;
      }
      applica(res.tipo); // riconcilia con l'esito reale del server
    });
  }

  const celle = celleMese(anno, mese);

  return (
    <>
      <OggiPresente contatti={contatti} uffici={uffici} assentiOggi={assentiOggi} oggiIso={oggiIso} />

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>Le mie assenze</h2>
        <div className="field" style={{ marginBottom: "1.1rem", maxWidth: 360 }}>
          <label htmlFor="me-presenza">Il tuo nominativo</label>
          <SelettorePersona
            id="me-presenza"
            contatti={contatti}
            selezionato={me}
            onSeleziona={setMe}
            placeholder="Cerca il tuo nominativo…"
          />
        </div>

        {errore && <div className="alert">{errore}</div>}
        {!me && !errore && (
          <p className="help" style={{ marginBottom: "0.9rem" }}>
            Cerca e seleziona il tuo nominativo, poi clicca sui giorni: un clic per assente,
            un altro clic per smart working, un altro ancora per tornare libero.
          </p>
        )}

        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.9rem" }}>
          <span className="status status--offline">Assente</span>
          <span className="status status--smartworking">Smart working</span>
        </div>

        <div className="calendar">
          <div className="calendar__head">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => vaiMese(-1)} aria-label="Mese precedente">
              ‹
            </button>
            <div className="calendar__title">{NOMI_MESE[mese - 1]} {anno}</div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => vaiMese(1)} aria-label="Mese successivo">
              ›
            </button>
          </div>
          <div className="calendar__grid calendar__grid--head">
            {NOMI_GIORNO.map((g) => (
              <div key={g} className="calendar__weekday">{g}</div>
            ))}
          </div>
          <div className="calendar__grid">
            {celle.map((iso, i) => {
              if (iso === null) {
                return <div key={`vuoto-${i}`} className="calendar__day calendar__day--empty" />;
              }
              const stato = mieGiorni.get(iso) ?? null;
              const titolo =
                stato === "assente"
                  ? "Assente — clicca per smart working"
                  : stato === "smartworking"
                    ? "Smart working — clicca per tornare libero"
                    : "Clicca per segnare assente";
              return (
                <button
                  key={iso}
                  type="button"
                  className={`calendar__day${stato ? ` calendar__day--${stato === "assente" ? "assente" : "smartworking"}` : ""}`}
                  onClick={() => handleClick(iso)}
                  disabled={!me}
                  title={titolo}
                >
                  {Number(iso.slice(-2))}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
