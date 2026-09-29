"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ufficio } from "@/types";
import { elencoIndentato } from "@/lib/uffici-tree";

interface Props {
  uffici: Ufficio[];
  defaultUfficiIds?: string[];
  label?: string;
  name?: string;
}

// Variante multi-selezione di UfficioPicker: gli uffici scelti restano visibili
// come chip rimovibili, l'input di ricerca serve solo ad aggiungerne altri (mai
// a mostrare una selezione, dato che possono essere più di una). Il menu resta
// aperto dopo ogni scelta per aggiungerne velocemente più di uno di seguito.
export default function UfficiMultiPicker({
  uffici,
  defaultUfficiIds = [],
  label = "Uffici",
  name = "ufficiIds",
}: Props) {
  const elenco = useMemo(() => elencoIndentato(uffici), [uffici]);
  const nomePerId = useMemo(() => new Map(elenco.map((u) => [u.id, u.nome])), [elenco]);

  const [selezionati, setSelezionati] = useState<string[]>(defaultUfficiIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? elenco.filter((u) => u.nome.toLowerCase().includes(q)) : elenco;
    return base.filter((u) => !selezionati.includes(u.id));
  }, [elenco, query, selezionati]);

  function aggiungi(id: string) {
    setSelezionati((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
  }
  function rimuovi(id: string) {
    setSelezionati((prev) => prev.filter((x) => x !== id));
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
    <div className="field" ref={wrapRef} style={{ position: "relative" }}>
      <label htmlFor="uffici-multi-search">{label}</label>

      {selezionati.length > 0 && (
        <div className="chip-row">
          {selezionati.map((id) => (
            <span key={id} className="chip">
              {nomePerId.get(id) ?? id}
              <input type="hidden" name={name} value={id} />
              <button
                type="button"
                className="chip__remove"
                onClick={() => rimuovi(id)}
                aria-label={`Rimuovi ${nomePerId.get(id) ?? "ufficio"}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id="uffici-multi-search"
        className="input"
        autoComplete="off"
        placeholder="Cerca Area, Settore o Ufficio da aggiungere…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && (
        <ul className="picker-dropdown">
          {filtrati.length > 0 ? (
            filtrati.map((u) => (
              <li
                key={u.id}
                onMouseDown={() => aggiungi(u.id)}
                className={`picker-opt picker-opt--${u.livello}`}
                style={{ paddingLeft: `${0.9 + u.profondita * 1.1}rem` }}
              >
                {u.nome}
              </li>
            ))
          ) : (
            <li className="picker-opt picker-opt--empty">
              {query ? "Nessun risultato" : "Tutti gli uffici sono già stati aggiunti"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
