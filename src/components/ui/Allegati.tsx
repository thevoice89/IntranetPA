import type { Allegato } from "@/types";

// Elenco di allegati (file o link) mostrato sotto una comunicazione.
export function Allegati({ allegati }: { allegati?: Allegato[] }) {
  if (!allegati || allegati.length === 0) return null;
  return (
    <div className="allegati">
      {allegati.map((a) => (
        <a
          key={a.id}
          className="allegato"
          href={a.url}
          target="_blank"
          rel="noreferrer"
        >
          <span aria-hidden>{a.tipo === "file" ? "📎" : "🔗"}</span>
          {a.etichetta}
        </a>
      ))}
    </div>
  );
}
