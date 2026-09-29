"use client";

import { useState } from "react";

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

// Selettore data a comparsa: sostituisce l'<input type="date"> nativo (il cui
// calendario a popup non è personalizzabile e stona con la grafica del resto
// della pagina) con un mini-calendario coerente, basato sugli stessi stili
// .calendar__* già usati altrove. Condiviso tra Presenze ("Le mie assenze"/"Oggi è
// presente?") e il selettore data di Prenotazione sale.
export function SelettoreData({
  id,
  value,
  oggiIso,
  onSeleziona,
}: {
  id: string;
  value: string;
  oggiIso: string;
  onSeleziona: (iso: string) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [annoView, setAnnoView] = useState(() => Number(value.slice(0, 4)));
  const [meseView, setMeseView] = useState(() => Number(value.slice(5, 7)));

  function apri() {
    setAnnoView(Number(value.slice(0, 4)));
    setMeseView(Number(value.slice(5, 7)));
    setAperto(true);
  }

  function vaiMese(delta: number) {
    let nm = meseView + delta;
    let na = annoView;
    if (nm < 1) { nm = 12; na -= 1; }
    if (nm > 12) { nm = 1; na += 1; }
    setAnnoView(na);
    setMeseView(nm);
  }

  const celle = celleMese(annoView, meseView);

  return (
    <div className="autocomplete">
      <input
        id={id}
        className="input"
        readOnly
        value={formatDataBreve(value)}
        onClick={apri}
        onBlur={() => setAperto(false)}
      />
      {aperto && (
        <div className="date-picker__popover">
          <div className="calendar__head">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => vaiMese(-1)}
              aria-label="Mese precedente"
            >
              ‹
            </button>
            <div className="calendar__title">{NOMI_MESE[meseView - 1]} {annoView}</div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => vaiMese(1)}
              aria-label="Mese successivo"
            >
              ›
            </button>
          </div>
          <div className="calendar__grid calendar__grid--head">
            {NOMI_GIORNO.map((g) => (
              <div key={g} className="calendar__weekday">{g}</div>
            ))}
          </div>
          <div className="calendar__grid">
            {celle.map((iso, i) =>
              iso === null ? (
                <div key={`vuoto-${i}`} className="calendar__day calendar__day--empty" />
              ) : (
                <button
                  key={iso}
                  type="button"
                  className={`calendar__day${iso === value ? " calendar__day--selezionato" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSeleziona(iso);
                    setAperto(false);
                  }}
                >
                  {Number(iso.slice(-2))}
                </button>
              )
            )}
          </div>
          {value !== oggiIso && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: "0.7rem", width: "100%" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSeleziona(oggiIso);
                setAperto(false);
              }}
            >
              Oggi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
