"use client";

import { useMemo, useState } from "react";
import type { Contatto } from "@/types";

// Campo "Nome e cognome" di un modulo, con ricerca a comparsa sulla rubrica —
// stessa resa grafica di SelettorePersona (.autocomplete/.autocomplete__list),
// per coerenza col resto del sito invece della tendina nativa del browser
// (<datalist>, non tematizzabile). A differenza di SelettorePersona qui il
// testo digitato resta sempre il valore inviato, anche se non corrisponde a
// nessun contatto: il modulo deve restare compilabile da chi non è (ancora)
// censito in rubrica. Scegliendo un suggerimento, se forniti `servizioSelectId`
// e `opzioniServizio`, autocompila anche la select "Servizio di assegnazione"
// altrove nel form in base all'ufficio del contatto — i due campi non
// condividono stato React, quindi l'aggiornamento passa da una lettura DOM
// diretta (stesso principio pragmatico già usato per RichTextEditor/menu).
export function CampoNomeAutocompletaServizio({
  id,
  name,
  required,
  contatti,
  servizioSelectId,
  opzioniServizio,
}: {
  id: string;
  name: string;
  required: boolean;
  contatti: Contatto[];
  servizioSelectId?: string;
  opzioniServizio?: string[];
}) {
  const [testo, setTesto] = useState("");
  const [aperto, setAperto] = useState(false);

  const opzioniValide = useMemo(() => new Set(opzioniServizio ?? []), [opzioniServizio]);

  const filtrati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    if (!q) return [];
    return contatti.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [testo, contatti]);

  function scegli(c: Contatto) {
    setTesto(c.nome);
    setAperto(false);
    if (!servizioSelectId) return;
    const match = c.uffici.find((u) => opzioniValide.has(u.nome));
    if (!match) return;
    const el = document.getElementById(servizioSelectId);
    if (el instanceof HTMLSelectElement) el.value = match.nome;
  }

  return (
    <div className="autocomplete">
      <input
        id={id}
        name={name}
        className="input"
        value={testo}
        autoComplete="off"
        required={required}
        onChange={(e) => {
          setTesto(e.target.value);
          setAperto(true);
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
                onClick={() => scegli(c)}
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
