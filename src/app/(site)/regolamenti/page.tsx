import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getRegolamenti, cercaTestoRegolamenti } from "@/lib/data";
import { getCurrentUser, canEditRegolamenti } from "@/lib/auth";
import { EditButton } from "@/components/ui/EditButton";
import type { Regolamento } from "@/types";

export const dynamic = "force-dynamic";

export default async function RegolamentiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [user, regolamenti, risultati] = await Promise.all([
    getCurrentUser(),
    query ? Promise.resolve(null) : getRegolamenti(),
    query ? cercaTestoRegolamenti(query) : Promise.resolve(null),
  ]);

  // Raggruppa per categoria (solo vista senza ricerca attiva).
  const perCategoria = new Map<string, Regolamento[]>();
  if (regolamenti) {
    for (const r of regolamenti) {
      const list = perCategoria.get(r.categoria) ?? [];
      list.push(r);
      perCategoria.set(r.categoria, list);
    }
  }

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>{ROUTES.regolamenti.label}</h1>
            <p>{ROUTES.regolamenti.description}</p>
          </div>
          {user && canEditRegolamenti(user) && <EditButton href="/admin/regolamenti" />}
        </div>
      </header>

      <form action="/regolamenti" method="get" style={{ marginBottom: "1.5rem", maxWidth: 520 }}>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cerca nel contenuto dei regolamenti…"
          className="input"
        />
      </form>

      {query ? (
        <>
          <p className="help" style={{ marginBottom: "1rem" }}>
            {risultati!.length} risultati nel contenuto per “{query}”
          </p>
          {risultati!.length === 0 ? (
            <div className="card empty">Nessun regolamento contiene questo testo.</div>
          ) : (
            <ul className="admin-list">
              {risultati!.map((r) => (
                <li key={r.id} className="card admin-row">
                  <span style={{ fontSize: "1.4rem" }}>📄</span>
                  <div className="admin-row__main">
                    <div className="admin-row__title">{r.titolo}</div>
                    <div className="admin-row__sub">{r.categoria}</div>
                    <div className="snippet">
                      {r.snippetParti.map((parte, i) =>
                        parte.match ? <mark key={i}>{parte.testo}</mark> : <span key={i}>{parte.testo}</span>
                      )}
                    </div>
                  </div>
                  <div className="admin-row__actions">
                    <Link href={`/regolamenti/${r.id}`} className="btn btn--primary btn--sm">
                      Sfoglia
                    </Link>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                      Apri
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : regolamenti!.length === 0 ? (
        <div className="card empty">Nessun regolamento disponibile.</div>
      ) : (
        [...perCategoria.entries()].map(([categoria, items]) => (
          <div key={categoria}>
            <div className="section-title">{categoria}</div>
            <ul className="admin-list">
              {items.map((r) => (
                <li key={r.id} className="card admin-row">
                  <span style={{ fontSize: "1.4rem" }}>📄</span>
                  <div className="admin-row__main">
                    <div className="admin-row__title">{r.titolo}</div>
                    <div className="admin-row__sub">Documento PDF</div>
                  </div>
                  <div className="admin-row__actions">
                    <Link href={`/regolamenti/${r.id}`} className="btn btn--primary btn--sm">
                      Sfoglia
                    </Link>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                      Apri
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
