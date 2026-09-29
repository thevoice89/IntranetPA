"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Contatto } from "@/types";

// Lista contatti con filtro istantaneo lato client, stesso pattern di
// RubricaTavola (rubrica pubblica): niente andata/ritorno al server per cercare.
export default function RubricaAdminLista({
  contatti,
  removeContatto,
}: {
  contatti: Contatto[];
  removeContatto: (formData: FormData) => void;
}) {
  const [q, setQ] = useState("");

  const filtrati = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return contatti;
    return contatti.filter((c) =>
      [c.nome, ...c.uffici.map((u) => u.nome), c.ruolo, c.interno, c.telefono, c.cellulare, c.email]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [q, contatti]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍  Cerca per nome, ufficio, interno…"
        className="input rubrica-filter"
        aria-label="Cerca nella rubrica"
      />

      {filtrati.length === 0 ? (
        <div className="card empty">Nessun contatto trovato.</div>
      ) : (
        <ul className="admin-list">
          {filtrati.map((c) => (
            <li key={c.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {c.nome}
                  {c.interno && <span className="badge badge--tipo"> int. {c.interno}</span>}
                </div>
                <div className="admin-row__sub">
                  {[c.uffici.map((u) => u.nome).join(", "), c.ruolo, c.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="admin-row__actions">
                <Link href={`/admin/rubrica?edit=${c.id}`} className="btn btn--ghost btn--sm">
                  Modifica
                </Link>
                <form action={removeContatto} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn btn--danger btn--sm">
                    Elimina
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
