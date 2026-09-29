"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contatto, ResponsabileUfficio } from "@/types";

interface Props {
  contatti: Contatto[];
  // Responsabili già assegnati al nodo: servono sia gli id (da rispedire) sia i
  // nomi (da mostrare come chip) anche per contatti non più presenti in rubrica.
  defaultResponsabili?: ResponsabileUfficio[];
  inputId: string;
  name?: string;
}

// Multi-selezione di nominativi della rubrica, stessa forma di UfficiMultiPicker
// (chip rimovibili + ricerca che aggiunge, menu che resta aperto per inserirne
// più di uno di seguito). Due differenze dovute al fatto che qui si cerca tra
// centinaia di contatti e non tra una quarantina di uffici: il menu non elenca
// mai tutto ma solo i primi risultati di una ricerca, e l'id dell'input è passato
// dal chiamante perché la pagina /admin/uffici può montare il picker su un nodo
// qualsiasi dell'albero (un id fisso si duplicherebbe).
export default function ResponsabiliPicker({
  contatti,
  defaultResponsabili = [],
  inputId,
  name = "responsabiliIds",
}: Props) {
  const [selezionati, setSelezionati] = useState<ResponsabileUfficio[]>(defaultResponsabili);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const giaScelti = new Set(selezionati.map((s) => s.id));
    return contatti
      .filter(
        (c) =>
          !giaScelti.has(c.id) &&
          (c.nome.toLowerCase().includes(q) ||
            c.ruolo.toLowerCase().includes(q) ||
            c.uffici.some((u) => u.nome.toLowerCase().includes(q)))
      )
      .slice(0, 8);
  }, [contatti, query, selezionati]);

  function aggiungi(c: Contatto) {
    setSelezionati((prev) =>
      prev.some((s) => s.id === c.id) ? prev : [...prev, { id: c.id, nome: c.nome }]
    );
    setQuery("");
  }
  function rimuovi(id: string) {
    setSelezionati((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="field" ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: "16rem" }}>
      <label htmlFor={inputId}>Responsabili</label>

      {selezionati.length > 0 && (
        <div className="chip-row">
          {selezionati.map((s) => (
            <span key={s.id} className="chip">
              {s.nome}
              <input type="hidden" name={name} value={s.id} />
              <button
                type="button"
                className="chip__remove"
                onClick={() => rimuovi(s.id)}
                aria-label={`Rimuovi ${s.nome}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id={inputId}
        className="input"
        autoComplete="off"
        placeholder="Cerca un nominativo in rubrica…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && query.trim() !== "" && (
        <ul className="picker-dropdown">
          {filtrati.length > 0 ? (
            filtrati.map((c) => (
              <li key={c.id} onMouseDown={() => aggiungi(c)} className="picker-opt">
                {c.nome}
                {c.uffici.length > 0 && (
                  <span className="help"> · {c.uffici.map((u) => u.nome).join(", ")}</span>
                )}
              </li>
            ))
          ) : (
            <li className="picker-opt picker-opt--empty">Nessun risultato</li>
          )}
        </ul>
      )}
    </div>
  );
}
