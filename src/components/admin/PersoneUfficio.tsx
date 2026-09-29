"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Contatto } from "@/types";
import { aggiungiPersonaUfficio, rimuoviPersonaUfficio } from "@/app/admin/actions";

interface PersonaLeggera {
  id: string;
  nome: string;
  ruolo: string;
}

// Elenco delle persone assegnate direttamente a un nodo dell'organigramma
// (tabella rubrica_uffici), con aggiunta/rimozione senza passare per il form
// di modifica del contatto in Rubrica. Stesso schema "instant, ottimistico"
// di MenuSortableList: le azioni sono chiamate direttamente (non via <form>),
// lo stato locale si aggiorna subito e la revalidate gira in background.
// Cliccare un nominativo porta alla sua anagrafica in Rubrica (?edit=id).
export default function PersoneUfficio({
  ufficioId,
  contatti,
}: {
  ufficioId: string;
  contatti: Contatto[];
}) {
  const [persone, setPersone] = useState<PersonaLeggera[]>(() =>
    contatti
      .filter((c) => c.uffici.some((u) => u.id === ufficioId))
      .map((c) => ({ id: c.id, nome: c.nome, ruolo: c.ruolo }))
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  const disponibili = useMemo(() => {
    const assegnatiIds = new Set(persone.map((p) => p.id));
    const q = query.trim().toLowerCase();
    return contatti
      .filter((c) => !assegnatiIds.has(c.id))
      .filter((c) => !q || c.nome.toLowerCase().includes(q) || c.ruolo.toLowerCase().includes(q))
      .slice(0, 8);
  }, [contatti, persone, query]);

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

  function aggiungi(c: Contatto) {
    setPersone((prev) =>
      [...prev, { id: c.id, nome: c.nome, ruolo: c.ruolo }].sort((a, b) =>
        a.nome.localeCompare(b.nome, "it")
      )
    );
    setQuery("");
    setOpen(false);
    startTransition(() => {
      aggiungiPersonaUfficio(ufficioId, c.id);
    });
  }

  function rimuovi(id: string, nome: string) {
    if (!confirm(`Rimuovere ${nome} da questo ufficio? Resterà comunque in rubrica.`)) return;
    setPersone((prev) => prev.filter((p) => p.id !== id));
    startTransition(() => {
      rimuoviPersonaUfficio(ufficioId, id);
    });
  }

  return (
    <details className="org-persone">
      <summary className="org-persone__summary">
        👥 <strong>{persone.length}</strong> {persone.length === 1 ? "persona" : "persone"}
      </summary>
      <div className="org-persone__body">
        {persone.length > 0 && (
          <ul className="org-persone__list">
            {persone.map((p) => (
              <li key={p.id} className="org-persone__item">
                <Link href={`/admin/rubrica?edit=${p.id}`} className="org-persone__link">
                  {p.nome}
                  {p.ruolo && <span className="org-persone__ruolo"> · {p.ruolo}</span>}
                </Link>
                <button
                  type="button"
                  className="chip__remove"
                  onClick={() => rimuovi(p.id, p.nome)}
                  aria-label={`Rimuovi ${p.nome} da questo ufficio`}
                  title="Rimuovi da questo ufficio"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div ref={wrapRef} className="org-persone__aggiungi">
          <input
            className="input"
            autoComplete="off"
            placeholder="Aggiungi una persona dalla rubrica…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <ul className="picker-dropdown">
              {disponibili.length > 0 ? (
                disponibili.map((c) => (
                  <li key={c.id} className="picker-opt" onMouseDown={() => aggiungi(c)}>
                    {c.nome}
                    {c.ruolo && <span className="help"> · {c.ruolo}</span>}
                  </li>
                ))
              ) : (
                <li className="picker-opt picker-opt--empty">
                  {query ? "Nessun risultato" : "Tutti i contatti sono già assegnati"}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
