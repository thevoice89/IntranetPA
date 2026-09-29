import Link from "next/link";
import { cerca } from "@/lib/data";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  Comunicazione: "badge",
  Servizio: "badge--tipo",
  Portale: "badge--tipo",
  Regolamento: "badge--highlight",
  "Carta intestata": "badge--tipo",
  Formazione: "badge",
  Contatto: "badge--tipo",
  Procedura: "badge--highlight",
  FAQ: "badge--highlight",
  Modulo: "badge--highlight",
  Sondaggio: "badge--highlight",
  Documento: "badge--tipo",
};

export default async function CercaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const risultati = query ? await cerca(query) : [];

  return (
    <section>
      <header className="page-header">
        <h1>Cerca</h1>
        <p>
          Cerca in tutte le sezioni: comunicazioni, servizi, portali, regolamenti, carta
          intestata, formazione, rubrica, procedure e moduli.
        </p>
      </header>

      {!query && (
        <p className="help" style={{ marginBottom: "1rem" }}>
          Usa il campo di ricerca nel menu a sinistra.
        </p>
      )}

      {query && (
        <p className="help" style={{ marginBottom: "1rem" }}>
          {risultati.length} risultati per “{query}”
        </p>
      )}

      {query && risultati.length === 0 ? (
        <div className="card empty">Nessun risultato.</div>
      ) : (
        <ul className="admin-list">
          {risultati.map((r, i) => (
            <li key={i} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  <span className={`badge ${BADGE[r.tipo] ?? "badge"}`}>{r.tipo}</span>{" "}
                  {r.titolo}
                  {r.presenza && (
                    <>
                      {" "}
                      <span
                        className={`status status--${
                          r.presenza === "assente" ? "offline" : r.presenza === "smartworking" ? "smartworking" : "attivo"
                        }`}
                      >
                        {r.presenza === "assente" ? "Assente" : r.presenza === "smartworking" ? "Smart working" : "Presente"}
                      </span>
                    </>
                  )}
                </div>
                <div className="admin-row__sub">{r.sottotitolo}</div>
              </div>
              <div className="admin-row__actions">
                {r.href.startsWith("/api/") || r.href.startsWith("http") ? (
                  <a href={r.href} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                    Apri
                  </a>
                ) : (
                  <Link href={r.href} className="btn btn--ghost btn--sm">
                    Apri
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
