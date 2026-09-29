"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BloccoSala, PrenotazioneSala } from "@/types";
import { slotGiornoPerSala } from "@/lib/sale-orari";
import { caricaPrenotazioniSettimana, caricaBlocchiSettimana } from "@/app/(site)/prenotazione-sale/actions";
import { creaBlocchiSala } from "@/app/admin/actions";

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

// Stessa logica di raggruppaSlotConsecutivi in PrenotazioneSaleApp.tsx: unisce gli
// slot scelti in fasce consecutive per il riepilogo sotto il calendario.
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

function formatGiornoBreve(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${NOMI_MESE_BREVE[m - 1]}`;
}

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

// Lunedì della settimana che contiene la data indicata: stessa logica di
// lunediSettimana in PrenotazioneSaleApp.tsx.
function lunediSettimana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return aggiungiGiorni(iso, -offset);
}

function prenotazioneSlot(
  prenotazioni: PrenotazioneSala[],
  giorno: string,
  minuti: number
): PrenotazioneSala | undefined {
  const inizioSlot = formatOra(minuti);
  const fineSlot = formatOra(minuti + 30);
  return prenotazioni.find((p) => p.data === giorno && p.oraInizio < fineSlot && p.oraFine > inizioSlot);
}

function bloccoSlot(blocchi: BloccoSala[], giorno: string, minuti: number): BloccoSala | undefined {
  const inizioSlot = formatOra(minuti);
  const fineSlot = formatOra(minuti + 30);
  return blocchi.find((b) => b.data === giorno && b.oraInizio < fineSlot && b.oraFine > inizioSlot);
}

// Calendario settimanale per bloccare singoli orari di UNA sala (opzione "slot
// orari" di /admin/prenotazioni-sale, distinta dall'interruttore "sala non
// prenotabile"): a differenza del calendario pubblico in PrenotazioneSaleApp.tsx
// qui non c'è un wizard — si selezionano una o più celle libere e si conferma con
// un solo pulsante, senza dover indicare un motivo. Gli slot già bloccati
// (blocchiSettimana) sono mostrati ma non cliccabili da qui: si rimuovono
// dall'elenco sotto il calendario (nella pagina server), per non mescolare
// selezione-e-conferma e click-singolo-istantaneo nella stessa griglia.
export default function BloccaSlotApp({
  salaId,
  salaNome,
  oggiIso,
}: {
  salaId: string;
  salaNome: string;
  oggiIso: string;
}) {
  const [settimanaInizio, setSettimanaInizio] = useState(() => lunediSettimana(oggiIso));
  const [slotSelezionati, setSlotSelezionati] = useState<Slot[]>([]);
  const [prenotazioniSettimana, setPrenotazioniSettimana] = useState<PrenotazioneSala[]>([]);
  const [blocchiSettimana, setBlocchiSettimana] = useState<BloccoSala[]>([]);
  const [, startTransition] = useTransition();

  const giorniSettimana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => aggiungiGiorni(settimanaInizio, i)),
    [settimanaInizio]
  );

  const slotGiorno = useMemo(() => slotGiornoPerSala(salaNome), [salaNome]);

  useEffect(() => {
    let annullato = false;
    startTransition(async () => {
      const [righe, blocchi] = await Promise.all([
        caricaPrenotazioniSettimana(salaId, settimanaInizio, aggiungiGiorni(settimanaInizio, 6)),
        caricaBlocchiSettimana(salaId, settimanaInizio, aggiungiGiorni(settimanaInizio, 6)),
      ]);
      if (!annullato) {
        setPrenotazioniSettimana(righe);
        setBlocchiSettimana(blocchi);
      }
    });
    return () => {
      annullato = true;
    };
  }, [salaId, settimanaInizio]);

  const slotOrdinati = useMemo(
    () =>
      [...slotSelezionati].sort((a, b) =>
        a.data === b.data ? a.minuti - b.minuti : a.data.localeCompare(b.data)
      ),
    [slotSelezionati]
  );

  const fasceSelezionate = useMemo(() => raggruppaSlotConsecutivi(slotOrdinati), [slotOrdinati]);

  function toggleSlot(giorno: string, minuti: number) {
    setSlotSelezionati((prev) => {
      const esiste = prev.some((s) => s.data === giorno && s.minuti === minuti);
      if (esiste) return prev.filter((s) => !(s.data === giorno && s.minuti === minuti));
      return [...prev, { data: giorno, minuti }];
    });
  }

  function rimuoviFascia(fascia: FasciaOraria) {
    setSlotSelezionati((prev) =>
      prev.filter(
        (s) => !(s.data === fascia.data && s.minuti >= fascia.minutiInizio && s.minuti < fascia.minutiFine)
      )
    );
  }

  return (
    <form action={creaBlocchiSala} className="form">
      <input type="hidden" name="salaId" value={salaId} />
      {slotOrdinati.map((s) => (
        <input
          key={`${s.data}-${s.minuti}`}
          type="hidden"
          name="slot"
          value={`${s.data}|${formatOra(s.minuti)}`}
        />
      ))}

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
                    ? "Già bloccato: rimuovilo dall'elenco sotto il calendario"
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
        <p className="selezione-riepilogo__titolo">Orari selezionati da bloccare</p>
        {fasceSelezionate.length === 0 ? (
          <p className="help">Nessun orario selezionato: clicca una cella libera nel calendario qui sopra.</p>
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

      <div className="admin-row__actions" style={{ marginTop: "1.1rem" }}>
        <button type="submit" className="btn btn--primary" disabled={slotOrdinati.length === 0}>
          Blocca gli orari selezionati
        </button>
      </div>
    </form>
  );
}
