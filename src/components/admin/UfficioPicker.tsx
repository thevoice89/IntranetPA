"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ufficio } from "@/types";
import { elencoIndentato } from "@/lib/uffici-tree";

interface Props {
  uffici: Ufficio[];
  defaultUfficioId?: string;
  label?: string;
  name?: string;
}

// Picker di ricerca su Area/Settore/Ufficio: ogni nodo, a qualunque livello, è
// selezionabile. Stesso comportamento del picker piatto originario (mostra
// solo la scelta quando chiuso, si svuota al focus per filtrare l'elenco
// completo) — la lista è solo indentata per mostrare la gerarchia.
export default function UfficioPicker({
  uffici,
  defaultUfficioId,
  label = "Ufficio",
  name = "ufficioId",
}: Props) {
  const elenco = useMemo(() => elencoIndentato(uffici), [uffici]);
  const iniziale = elenco.find((u) => u.id === defaultUfficioId);

  const [ufficioId, setUfficioId] = useState(iniziale?.id ?? "");
  const [query, setQuery] = useState(iniziale?.nome ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? elenco.filter((u) => u.nome.toLowerCase().includes(q)) : elenco;
  }, [elenco, query]);

  function scegli(u: Ufficio) {
    setUfficioId(u.id);
    setQuery(u.nome);
    setOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Se si chiude senza scegliere, torna al nome del nodo davvero
        // selezionato: l'input non deve mai mostrare testo di ricerca "orfano".
        setQuery(elenco.find((u) => u.id === ufficioId)?.nome ?? "");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ufficioId, elenco]);

  return (
    <div className="field" ref={wrapRef} style={{ position: "relative" }}>
      <label htmlFor="ufficio-search">{label}</label>
      <input
        id="ufficio-search"
        className="input"
        autoComplete="off"
        placeholder="Cerca Area, Settore o Ufficio…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          // Svuota per mostrare subito l'elenco completo (non solo il nodo
          // già scelto, che altrimenti si auto-filtrerebbe a un solo risultato).
          setQuery("");
          setOpen(true);
        }}
      />
      <input type="hidden" name={name} value={ufficioId} />

      {open && (
        <ul className="picker-dropdown">
          {filtrati.length > 0 ? (
            filtrati.map((u) => (
              <li
                key={u.id}
                onMouseDown={() => scegli(u)}
                className={`picker-opt picker-opt--${u.livello}`}
                style={{ paddingLeft: `${0.9 + u.profondita * 1.1}rem` }}
              >
                {u.nome}
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
