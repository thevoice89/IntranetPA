"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Servizio } from "@/types";
import { removeServizio, reorderServizi } from "@/app/admin/actions";

export default function SortableList({ servizi }: { servizi: Servizio[] }) {
  const [items, setItems] = useState(servizi);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((s) => s.id === dragId);
      const toIdx = next.findIndex((s) => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      startTransition(() => {
        reorderServizi(next.map((s) => s.id));
      });
      return next;
    });
    setDragId(null);
  }

  return (
    <ul className="admin-list">
      {items.map((s) => (
        <li
          key={s.id}
          className="card admin-row"
          draggable
          onDragStart={() => setDragId(s.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(s.id)}
          onDragEnd={() => setDragId(null)}
          style={{ opacity: dragId === s.id ? 0.5 : 1, cursor: "grab" }}
        >
          <span className="admin-row__handle" aria-hidden title="Trascina per riordinare">
            ⠿
          </span>
          <span style={{ fontSize: "1.4rem" }}>{s.icona}</span>
          <div className="admin-row__main">
            <div className="admin-row__title">{s.nome}</div>
            <div className="admin-row__sub">
              {s.categoria} · {s.stato} · {s.url || "nessun URL"}
            </div>
          </div>
          <div className="admin-row__actions">
            <Link href={`/admin/servizi?edit=${s.id}`} className="btn btn--ghost btn--sm">
              Modifica
            </Link>
            <form action={removeServizio} className="inline-form">
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="btn btn--danger btn--sm">
                Elimina
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
