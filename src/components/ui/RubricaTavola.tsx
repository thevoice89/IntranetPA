"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Contatto } from "@/types";

// Tabella rubrica con filtro istantaneo lato client e raggruppamento per ufficio.
export function RubricaTavola({
  contatti,
  isAdmin,
}: {
  contatti: Contatto[];
  isAdmin: boolean;
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

  // Raggruppa per ufficio: un contatto con più uffici compare in ciascun
  // gruppo a cui appartiene (come un'etichetta), non solo nel primo.
  const gruppi = useMemo(() => {
    const map = new Map<string, Contatto[]>();
    for (const c of filtrati) {
      const nomi = c.uffici.length > 0 ? c.uffici.map((u) => u.nome) : ["Senza ufficio"];
      for (const nome of nomi) {
        const list = map.get(nome) ?? [];
        list.push(c);
        map.set(nome, list);
      }
    }
    return [...map.entries()];
  }, [filtrati]);

  const nCols = isAdmin ? 6 : 5;

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍  Filtra per nome, ufficio, interno…"
        className="input rubrica-filter"
        aria-label="Filtra la rubrica"
      />

      {filtrati.length === 0 ? (
        <div className="card empty">Nessun contatto trovato.</div>
      ) : (
        <table className="rubrica-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Interno</th>
              <th>Telefono</th>
              <th>Email</th>
              {isAdmin && <th aria-label="Azioni" />}
            </tr>
          </thead>
          <tbody>
            {gruppi.map(([ufficio, items]) => (
              <Gruppo
                key={ufficio}
                ufficio={ufficio}
                items={items}
                nCols={nCols}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Gruppo({
  ufficio,
  items,
  nCols,
  isAdmin,
}: {
  ufficio: string;
  items: Contatto[];
  nCols: number;
  isAdmin: boolean;
}) {
  return (
    <>
      <tr>
        <td className="rubrica-table__office" colSpan={nCols}>
          {ufficio}
        </td>
      </tr>
      {items.map((c) => (
        <tr key={c.id}>
          <td className="rubrica-table__name">{c.nome}</td>
          <td>{c.ruolo}</td>
          <td className="rubrica-table__int">{c.interno}</td>
          <td>
            {c.telefono}
            {c.cellulare && (
              <span className="help"> · {c.cellulare}</span>
            )}
          </td>
          <td>
            {c.email && (
              <a href={`mailto:${c.email}`}>{c.email}</a>
            )}
          </td>
          {isAdmin && (
            <td>
              <Link
                href={`/admin/rubrica?edit=${c.id}`}
                className="btn btn--ghost btn--sm"
              >
                Modifica
              </Link>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}
