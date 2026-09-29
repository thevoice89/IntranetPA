"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Portale } from "@/types";
import { removePortale, reorderPortali } from "@/app/admin/actions";

export default function SortableList({ portali }: { portali: Portale[] }) {
  const [items, setItems] = useState(portali);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((p) => p.id === dragId);
      const toIdx = next.findIndex((p) => p.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      startTransition(() => {
        reorderPortali(next.map((p) => p.id));
      });
      return next;
    });
    setDragId(null);
  }

  return (
    <ul className="admin-list">
      {items.map((p) => (
        <li
          key={p.id}
          className="card admin-row"
          draggable
          onDragStart={() => setDragId(p.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(p.id)}
          onDragEnd={() => setDragId(null)}
          style={{ opacity: dragId === p.id ? 0.5 : 1, cursor: "grab" }}
        >
          <span className="admin-row__handle" aria-hidden title="Trascina per riordinare">
            ⠿
          </span>
          <span style={{ fontSize: "1.4rem" }}>{p.icona}</span>
          <div className="admin-row__main">
            <div className="admin-row__title">{p.nome}</div>
            <div className="admin-row__sub">
              {p.categoria} · {p.stato} · {p.url || "nessun URL"}
            </div>
          </div>
          <div className="admin-row__actions">
            <Link href={`/admin/portali?edit=${p.id}`} className="btn btn--ghost btn--sm">
              Modifica
            </Link>
            <form action={removePortale} className="inline-form">
              <input type="hidden" name="id" value={p.id} />
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
