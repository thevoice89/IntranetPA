"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Contatto, PrenotazioneSala, Sala, BloccoSala } from "@/types";
import ContattoField from "@/components/ui/ContattoField";
import { slotGiornoPerSala } from "@/lib/sale-orari";
import { caricaPrenotazioniSettimana, caricaBlocchiSettimana, creaPrenotazioni } from "./actions";

const NOMI_GIORNO = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const NOMI_MESE_BREVE = [
  "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic",
];

interface Slot {
  data: string;
  minuti: number;
}

interface FasciaOraria {
  data: string;
  minutiInizio: number;
  minutiFine: number;
}

// Unisce gli slot ordinati in fasce consecutive per l'anteprima dello step di
// conferma: stessa logica di raggruppaSlotConsecutivi lato server
// (prenotazione-sale/actions.ts), qui solo per mostrare all'utente cosa verrà
// effettivamente creato (una fascia 9:00-14:00 per 5 click consecutivi, non 5 righe).
function raggruppaSlotConsecutivi(slotOrdinati: Slot[]): FasciaOraria[] {
  const fasce: FasciaOraria[] = [];
  for (const s of slotOrdinati) {
    const ultima = fasce[fasce.length - 1];
    if (ultima && ultima.data === s.data && ultima.minutiFine === s.minuti) {
      ultima.minutiFine = s.minuti + 30;
    } else {
      fasce.push({ data: s.data, minutiInizio: s.minuti, minutiFine: s.minuti + 30 });
    }
  }
  return fasce;
}

function formatDataItaliana(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatGiornoBreve(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${NOMI_MESE_BREVE[m - 1]}`;
}

// `minuti` = minuti dalla mezzanotte (es. 510 = 8:30).
function formatOra(minuti: number): string {
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function aggiungiGiorni(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Lunedì della settimana che contiene la data indicata (settimana Lun-Dom,
// stesso criterio di celleMese in components/ui/SelettoreData.tsx).
function lunediSettimana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return aggiungiGiorni(iso, -offset);
}

// Prenotazione (se esiste) che occupa lo slot [minuti, minuti+30) di quel giorno:
// usata sia per marcare la cella occupata sia per mostrare chi/per cosa è stata
// prenotata.
function prenotazioneSlot(
  prenotazioni: PrenotazioneSala[],
  giorno: string,
  minuti: number
): PrenotazioneSala | undefined {
  const inizioSlot = formatOra(minuti);
  const fineSlot = formatOra(minuti + 30);
  return prenotazioni.find((p) => p.data === giorno && p.oraInizio < fineSlot && p.oraFine > inizioSlot);
}

// Blocco (impostato dall'admin per questa sala, senza motivo) che occupa lo slot
// [minuti, minuti+30) di quel giorno, se esiste: stessa forma di prenotazioneSlot
// sopra, granularità a mezz'ora come le prenotazioni (vedi BloccoSala in
// types/index.ts).
function bloccoSlot(blocchi: BloccoSala[], giorno: string, minuti: number): BloccoSala | undefined {
  const inizioSlot = formatOra(minuti);
  const fineSlot = formatOra(minuti + 30);
  return blocchi.find((b) => b.data === giorno && b.oraInizio < fineSlot && b.oraFine > inizioSlot);
}

// Wizard a 3 step: "In quale sala?" -> "Quando?" (calendario settimanale: si prenota
// cliccando gli orari liberi uno alla volta, ogni click aggiunge/toglie quel singolo
// slot di mezz'ora, senza riempire quelli intermedi) -> "Conferma" (nominativo dalla
// rubrica + note, condivisi da tutti gli slot scelti). Un unico <form>: gli step
// successivi si limitano a mostrare/nascondere sezioni, gli input nascosti portano
// avanti lo stato scelto finché non si arriva alla submit finale in step 3.
export default function PrenotazioneSaleApp({
  sale,
  contatti,
  oggiIso,
  origine = "/prenotazione-sale",
}: {
  sale: Sala[];
  contatti: Contatto[];
  oggiIso: string;
  // Percorso pubblico da cui è montato il wizard (condiviso con
  // /prenotazione-sale/matrimoni): riportato in un hidden field così l'azione
  // server sa dove rimandare l'utente dopo il submit (vedi percorsoOrigine in
  // ./actions.ts).
  origine?: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sala, setSala] = useState<Sala | null>(null);
  const [settimanaInizio, setSettimanaInizio] = useState(() => lunediSettimana(oggiIso));
  const [slotSelezionati, setSlotSelezionati] = useState<Slot[]>([]);
  const [prenotazioniSettimana, setPrenotazioniSettimana] = useState<PrenotazioneSala[]>([]);
  const [blocchiSettimana, setBlocchiSettimana] = useState<BloccoSala[]>([]);
  // Toggle nello step di conferma: di norma il nominativo si sceglie dalla
  // rubrica interna (ContattoField), ma chi prenota può essere esterno
  // all'ente (es. associazione, privato per un matrimonio) — in quel caso si
  // inserisce a mano nominativo e contatto invece di cercarlo in rubrica.
  const [nominativoEsterno, setNominativoEsterno] = useState(false);
  const [, startTransition] = useTransition();

  const giorniSettimana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => aggiungiGiorni(settimanaInizio, i)),
    [settimanaInizio]
  );

  const slotGiorno = useMemo(() => slotGiornoPerSala(sala?.nome), [sala]);

  useEffect(() => {
    if (!sala) return;
    let annullato = false;
    startTransition(async () => {
      const [righe, blocchi] = await Promise.all([
        caricaPrenotazioniSettimana(sala.id, settimanaInizio, aggiungiGiorni(settimanaInizio, 6)),
        caricaBlocchiSettimana(sala.id, settimanaInizio, aggiungiGiorni(settimanaInizio, 6)),
      ]);
      if (!annullato) {
        setPrenotazioniSettimana(righe);
        setBlocchiSettimana(blocchi);
      }
    });
    return () => {
      annullato = true;
    };
  }, [sala, settimanaInizio]);

  const slotOrdinati = useMemo(
    () =>
      [...slotSelezionati].sort((a, b) =>
        a.data === b.data ? a.minuti - b.minuti : a.data.localeCompare(b.data)
      ),
    [slotSelezionati]
  );

  const fasceSelezionate = useMemo(() => raggruppaSlotConsecutivi(slotOrdinati), [slotOrdinati]);

  // Ogni click aggiunge o toglie un singolo slot di mezz'ora indipendente dagli
  // altri: cliccando le 11:00 e poi le 17:00 si prenotano solo 11:00-11:30 e
  // 17:00-17:30, mai l'intervallo intermedio.
  function toggleSlot(giorno: string, minuti: number) {
    setSlotSelezionati((prev) => {
      const esiste = prev.some((s) => s.data === giorno && s.minuti === minuti);
      if (esiste) return prev.filter((s) => !(s.data === giorno && s.minuti === minuti));
      return [...prev, { data: giorno, minuti }];
    });
  }

  // Rimuove dalla selezione tutti gli slot di una fascia (usata dalla "×" sul
  // chip di riepilogo sotto il calendario): la fascia è già un intervallo
  // contiguo, quindi basta togliere ogni slot di mezz'ora al suo interno.
  function rimuoviFascia(fascia: FasciaOraria) {
    setSlotSelezionati((prev) =>
      prev.filter(
        (s) => !(s.data === fascia.data && s.minuti >= fascia.minutiInizio && s.minuti < fascia.minutiFine)
      )
    );
  }

  return (
    <form action={creaPrenotazioni} className="form">
      <input type="hidden" name="origine" value={origine} />
      <input type="hidden" name="salaId" value={sala?.id ?? ""} />
      {slotOrdinati.map((s) => (
        <input
          key={`${s.data}-${s.minuti}`}
          type="hidden"
          name="slot"
          value={`${s.data}|${formatOra(s.minuti)}`}
        />
      ))}

      {step === 1 && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>In quale sala vuoi prenotare?</h2>
          <div className="sala-grid">
            {sale.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sala-card"
                onClick={() => {
                  setSala(s);
                  setSlotSelezionati([]);
                  setStep(2);
                }}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && sala && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginBottom: "0.9rem" }}
            onClick={() => setStep(1)}
          >
            ← Cambia sala
          </button>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.3rem" }}>Quando?</h2>
          <p className="help" style={{ marginBottom: "1.1rem" }}>
            {sala.nome} · clicca gli orari liberi che ti servono: ogni click aggiunge o toglie
            solo quello slot di mezz&apos;ora, anche se non consecutivo. Le celle rosse sono già
            occupate, quelle grigie sono nel passato, quelle a righe non sono disponibili.
          </p>

          <div className="sale-settimana__nav" style={{ marginBottom: "0.7rem" }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSettimanaInizio(aggiungiGiorni(settimanaInizio, -7))}
            >
              ‹ Settimana precedente
            </button>
            <span className="help">
              {formatGiornoBreve(giorniSettimana[0])} – {formatGiornoBreve(giorniSettimana[6])}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSettimanaInizio(aggiungiGiorni(settimanaInizio, 7))}
            >
              Settimana successiva ›
            </button>
          </div>

          <div className="presenza-tabella-wrap">
            <table className="sale-settimana">
              <thead>
                <tr>
                  <th className="sale-settimana__ora" />
                  {giorniSettimana.map((g, i) => (
                    <th key={g} className="sale-settimana__giorno">
                      <div>{NOMI_GIORNO[i]}</div>
                      <div>{formatGiornoBreve(g)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotGiorno.map((minuti) => (
                  <tr key={minuti}>
                    <th className="sale-settimana__ora">{formatOra(minuti)}</th>
                    {giorniSettimana.map((g) => {
                      const prenotazione = prenotazioneSlot(prenotazioniSettimana, g, minuti);
                      const blocco = !prenotazione ? bloccoSlot(blocchiSettimana, g, minuti) : undefined;
                      const passata = !prenotazione && !blocco && g < oggiIso;
                      const selezionato = slotSelezionati.some((s) => s.data === g && s.minuti === minuti);
                      const titolo = prenotazione
                        ? `${prenotazione.richiedente}${prenotazione.note ? ` — ${prenotazione.note}` : ""}`
                        : blocco
                        ? "Non disponibile"
                        : passata
                        ? "Data passata"
                        : `${formatGiornoBreve(g)} ${formatOra(minuti)}`;
                      const cliccabile = !prenotazione && !blocco && !passata;
                      return (
                        <td
                          key={g}
                          className={
                            prenotazione
                              ? "occupata"
                              : blocco
                              ? "bloccata"
                              : passata
                              ? "passata"
                              : selezionato
                              ? "libera selezionata"
                              : "libera"
                          }
                          onClick={cliccabile ? () => toggleSlot(g, minuti) : undefined}
                          title={titolo}
                        >
                          {prenotazione && <span className="presenza-dot presenza-dot--assente" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="selezione-riepilogo">
            <p className="selezione-riepilogo__titolo">Ore selezionate</p>
            {fasceSelezionate.length === 0 ? (
              <p className="help">Nessuna ora selezionata: clicca una cella libera nel calendario qui sopra.</p>
            ) : (
              <div className="chip-row">
                {fasceSelezionate.map((f) => (
                  <span key={`${f.data}-${f.minutiInizio}`} className="chip">
                    {formatGiornoBreve(f.data)}, {formatOra(f.minutiInizio)}–{formatOra(f.minutiFine)}
                    <button
                      type="button"
                      className="chip__remove"
                      onClick={() => rimuoviFascia(f)}
                      aria-label={`Rimuovi ${formatGiornoBreve(f.data)} ${formatOra(f.minutiInizio)}–${formatOra(f.minutiFine)}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.1rem" }}>
            <p className="help" style={{ marginBottom: "0.5rem" }}>
              Prenotazioni di questa settimana per {sala.nome}:
            </p>
            {prenotazioniSettimana.length === 0 ? (
              <p className="help">Nessuna: la sala è libera tutta la settimana.</p>
            ) : (
              <ul className="admin-list">
                {[...prenotazioniSettimana]
                  .sort((a, b) =>
                    a.data === b.data ? a.oraInizio.localeCompare(b.oraInizio) : a.data.localeCompare(b.data)
                  )
                  .map((p) => (
                    <li key={p.id} className="card admin-row">
                      <div className="admin-row__main">
                        <div className="admin-row__title">
                          {formatGiornoBreve(p.data)} · {p.oraInizio}–{p.oraFine} · {p.richiedente}
                        </div>
                        {p.note && <div className="admin-row__sub">{p.note}</div>}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="admin-row__actions" style={{ marginTop: "1.1rem" }}>
            <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>Indietro</button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={slotOrdinati.length === 0}
              onClick={() => setStep(3)}
            >
              Avanti
            </button>
          </div>
        </div>
      )}

      {step === 3 && sala && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>Conferma prenotazione</h2>
          <p style={{ marginBottom: "0.4rem" }}>
            <strong>{sala.nome}</strong>
          </p>
          <ul style={{ marginBottom: "1.1rem" }}>
            {fasceSelezionate.map((f) => (
              <li key={`${f.data}-${f.minutiInizio}`}>
                {formatDataItaliana(f.data)}, dalle {formatOra(f.minutiInizio)} alle {formatOra(f.minutiFine)}
              </li>
            ))}
          </ul>

          <div className="field">
            <label className="assistenza-opzione">
              <input
                type="checkbox"
                checked={nominativoEsterno}
                onChange={(e) => setNominativoEsterno(e.target.checked)}
              />
              Chi prenota è esterno (non in rubrica)
            </label>
          </div>

          {nominativoEsterno ? (
            <>
              <div className="field">
                <label htmlFor="nominativoEsterno">Nominativo</label>
                <input
                  id="nominativoEsterno"
                  name="nominativoEsterno"
                  className="input"
                  required
                  maxLength={200}
                  placeholder="Nome e cognome (o ente) di chi prenota"
                />
              </div>
              <div className="field">
                <label htmlFor="contattoEsterno">Contatto (facoltativo)</label>
                <input
                  id="contattoEsterno"
                  name="contattoEsterno"
                  className="input"
                  maxLength={200}
                  placeholder="Email o telefono"
                />
              </div>
            </>
          ) : (
            <ContattoField contatti={contatti} />
          )}

          <div className="field">
            <label htmlFor="note">Oggetto della riunione</label>
            <textarea
              id="note"
              name="note"
              className="textarea"
              rows={3}
              required
              placeholder="Es. Riunione di coordinamento settimanale"
            />
          </div>

          <div className="field">
            <label style={{ marginBottom: "0.4rem" }}>Serve altro? (facoltativo)</label>
            <div className="assistenza-opzioni">
              <div className="assistenza-blocco">
                <label className="assistenza-opzione">
                  <input name="assistenzaTecnica" type="checkbox" />
                  Mi serve assistenza Tecnica
                </label>
                <textarea
                  name="assistenzaTecnicaDettaglio"
                  className="textarea assistenza-dettaglio"
                  rows={2}
                  placeholder="Descrivi cosa ti serve, es. accensione riscaldamento, aria condizionata o prese elettriche…"
                />
              </div>
              <div className="assistenza-blocco">
                <label className="assistenza-opzione">
                  <input name="assistenzaInformatica" type="checkbox" />
                  Mi serve assistenza Informatica
                </label>
                <textarea
                  name="assistenzaInformaticaDettaglio"
                  className="textarea assistenza-dettaglio"
                  rows={2}
                  placeholder="Descrivi cosa ti serve, es. accesso wifi ospiti, account temporaneo…"
                />
              </div>
            </div>
          </div>

          <div className="admin-row__actions" style={{ marginTop: "1.1rem" }}>
            <button type="button" className="btn btn--ghost" onClick={() => setStep(2)}>Indietro</button>
            <button type="submit" className="btn btn--primary">Conferma prenotazione</button>
          </div>
        </div>
      )}
    </form>
  );
}
