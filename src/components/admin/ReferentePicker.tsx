"use client";

import { useState, useRef, useEffect } from "react";
import type { Contatto } from "@/types";

interface Props {
  contatti: Contatto[];
  defaultReferente?: string;
  defaultContatto?: string;
}

function buildContatto(c: Contatto): string {
  return [c.email, c.interno ? `int. ${c.interno}` : "", c.telefono]
    .filter(Boolean)
    .join(" · ");
}

export default function ReferentePicker({ contatti, defaultReferente = "", defaultContatto = "" }: Props) {
  const [query, setQuery] = useState(defaultReferente);
  const [referente, setReferente] = useState(defaultReferente);
  const [contatto, setContatto] = useState(defaultContatto);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered =
    query.length >= 1
      ? contatti
          .filter(
            (c) =>
              c.nome.toLowerCase().includes(query.toLowerCase()) ||
              c.uffici.some((u) => u.nome.toLowerCase().includes(query.toLowerCase())) ||
              c.ruolo.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 8)
      : [];

  function select(c: Contatto) {
    setQuery(c.nome);
    setReferente(c.nome);
    setContatto(buildContatto(c));
    setOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="field--row">
      <div className="field" ref={wrapRef} style={{ position: "relative" }}>
        <label htmlFor="referente-search">Referente</label>
        <input
          id="referente-search"
          className="input"
          placeholder="Cerca nella rubrica…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setReferente(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 1) setOpen(true);
          }}
        />
        <input type="hidden" name="referente" value={referente} />

        {open && filtered.length > 0 && (
          <ul className="picker-dropdown">
            {filtered.map((c) => (
              <li
                key={c.id}
                onMouseDown={() => select(c)}
                className="picker-opt"
              >
                <div style={{ fontWeight: 500 }}>{c.nome}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {[
                    c.uffici.map((u) => u.nome).join(", "),
                    c.ruolo,
                    c.interno ? `int. ${c.interno}` : "",
                    c.telefono,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field">
        <label htmlFor="referenteContatto">Contatto referente</label>
        <input
          id="referenteContatto"
          name="referenteContatto"
          className="input"
          placeholder="Auto-compilato dalla rubrica"
          value={contatto}
          onChange={(e) => setContatto(e.target.value)}
        />
      </div>
    </div>
  );
}
