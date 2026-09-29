"use client";

import { useMemo, useState } from "react";
import type { CartaIntestata } from "@/types";

// Stesso pattern di filtro istantaneo lato client di RubricaTavola: elenco corto,
// non serve una ricerca server-side, solo un modo rapido per trovare un titolo.
export function CartaIntestataLista({ elenco }: { elenco: CartaIntestata[] }) {
  const [q, setQ] = useState("");

  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return elenco;
    return elenco.filter((f) => f.titolo.toLowerCase().includes(term));
  }, [q, elenco]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍  Cerca per titolo…"
        className="input"
        style={{ marginBottom: "1.5rem", maxWidth: 520 }}
        aria-label="Cerca in Carta Intestata"
      />

      {filtrati.length === 0 ? (
        <div className="card empty">Nessun file trovato.</div>
      ) : (
        <ul className="admin-list">
          {filtrati.map((f) => (
            <li key={f.id} className="card admin-row">
              <span style={{ fontSize: "1.4rem" }}>{f.mime.startsWith("image/") ? "🖼️" : "📃"}</span>
              <div className="admin-row__main">
                <div className="admin-row__title">{f.titolo}</div>
                <div className="admin-row__sub">{f.mime}</div>
              </div>
              <div className="admin-row__actions">
                <a href={f.fileUrl} className="btn btn--primary btn--sm">
                  Scarica
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
