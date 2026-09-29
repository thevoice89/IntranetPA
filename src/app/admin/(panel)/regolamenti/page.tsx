import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditRegolamenti } from "@/lib/auth";
import { getRegolamenti, getCategorieRegolamenti } from "@/lib/data";
import { saveRegolamento, removeRegolamento } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminRegolamenti({
  searchParams,
}: {
  searchParams: Promise<{ nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditRegolamenti(user)) redirect("/admin");
  const { nuovo } = await searchParams;
  // Niente modifica per i regolamenti (solo caricamento/eliminazione): il
  // modulo di caricamento compare solo su richiesta esplicita ("+ Nuovo
  // regolamento"), altrimenti arrivando qui da loggati si vedrebbe sempre un
  // modulo di upload aperto anche senza aver chiesto di caricare nulla.
  const inFormMode = nuovo === "1";
  const [regolamenti, categorie] = await Promise.all([
    getRegolamenti(),
    getCategorieRegolamenti(),
  ]);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Regolamenti</h1>
            <p>Aggiungi regolamenti in PDF, consultabili online dai dipendenti.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/regolamenti" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/regolamenti?nuovo=1" className="btn btn--primary btn--sm">
              + Nuovo regolamento
            </Link>
          )}
        </div>
      </header>

      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>Nuovo regolamento</h2>
        <form action={saveRegolamento} className="form">
          <div className="field--row">
            <div className="field">
              <label htmlFor="titolo">Titolo</label>
              <input id="titolo" name="titolo" className="input" required />
            </div>
            <div className="field">
              <label htmlFor="categoria">Categoria</label>
              <input id="categoria" name="categoria" className="input" list="cat-regolamenti" placeholder="Es. Personale, Sicurezza…" defaultValue="Generale" />
              <datalist id="cat-regolamenti">
                {categorie.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label htmlFor="file">File PDF</label>
            <input id="file" name="file" type="file" accept="application/pdf" className="input" required />
          </div>
          <div>
            <button type="submit" className="btn btn--primary">Carica regolamento</button>
          </div>
        </form>
      </div>
      )}

      {!inFormMode && (
      regolamenti.length === 0 ? (
        <div className="card empty">Nessun regolamento caricato.</div>
      ) : (
        <ul className="admin-list">
          {regolamenti.map((r) => (
            <li key={r.id} className="card admin-row">
              <span style={{ fontSize: "1.3rem" }}>📄</span>
              <div className="admin-row__main">
                <div className="admin-row__title">{r.titolo}</div>
                <div className="admin-row__sub">{r.categoria} · PDF</div>
              </div>
              <div className="admin-row__actions">
                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                  Apri
                </a>
                <form action={removeRegolamento} className="inline-form">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )
      )}
    </section>
  );
}
