"use client";

import { useEffect, useMemo, useState } from "react";
import type { Contatto } from "@/types";

// Ricerca a comparsa su un nominativo della rubrica: digitando filtra la lista,
// cliccando una voce la seleziona. Se l'utente ridigita dopo aver scelto, la selezione
// si azzera finché non sceglie di nuovo una voce reale dal menu — non si può inviare
// testo libero. Condiviso tra Presenze ("Oggi è presente?"/"Le mie assenze") e il
// nominativo obbligatorio del form Segnalazioni.
export function SelettorePersona({
  id,
  contatti,
  selezionato,
  onSeleziona,
  placeholder,
}: {
  id: string;
  contatti: Contatto[];
  selezionato: Contatto | null;
  onSeleziona: (c: Contatto | null) => void;
  placeholder: string;
}) {
  const [testo, setTesto] = useState(selezionato?.nome ?? "");
  const [aperto, setAperto] = useState(false);

  // Sincronizza il campo solo quando arriva una selezione "dall'esterno" (es.
  // il ripristino da localStorage al primo caricamento): non deve svuotare il
  // campo quando è l'utente a digitare per cercare un nuovo nominativo (in tal
  // caso onChange ha già azzerato la selezione, vedi sotto).
  useEffect(() => {
    if (selezionato) setTesto(selezionato.nome);
  }, [selezionato]);

  const filtrati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    if (!q) return [];
    return contatti.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [testo, contatti]);

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
          {filtrati.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="autocomplete__item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTesto(c.nome);
                  onSeleziona(c);
                  setAperto(false);
                }}
              >
                {c.nome}
                {c.uffici.length > 0 && (
                  <span className="help"> · {c.uffici.map((u) => u.nome).join(", ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
