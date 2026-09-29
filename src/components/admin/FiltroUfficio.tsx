"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { UfficioIndentato } from "@/lib/uffici-tree";

// Filtro per ufficio via query string ?ufficio=<id>, condiviso tra le
// dashboard responsabili (Presenze del team, Formazione): di default non
// filtra nulla (mostra tutti i collaboratori visibili), selezionando una voce
// restringe a quell'ufficio e ai suoi discendenti. Guidato dall'URL (non da
// stato React) per sopravvivere alla navigazione tra mesi in Presenze, che è
// anch'essa un cambio di query string sullo stesso pattern.
export function FiltroUfficio({ opzioni }: { opzioni: UfficioIndentato[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selezionato = searchParams.get("ufficio") ?? "";

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("ufficio", id);
    else params.delete("ufficio");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="field" style={{ maxWidth: 320, marginBottom: "1.1rem" }}>
      <label htmlFor="filtro-ufficio">Filtra per ufficio</label>
      <select
        id="filtro-ufficio"
        className="select"
        value={selezionato}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Tutti</option>
        {opzioni.map((u) => (
          <option key={u.id} value={u.id}>
            {"— ".repeat(u.profondita)}
            {u.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
