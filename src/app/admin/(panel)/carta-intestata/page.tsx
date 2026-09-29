import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditCartaIntestata } from "@/lib/auth";
import { getCarteIntestate } from "@/lib/data";
import { saveCartaIntestata, removeCartaIntestata } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminCartaIntestata({
  searchParams,
}: {
  searchParams: Promise<{ nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditCartaIntestata(user)) redirect("/admin");
  const { nuovo } = await searchParams;
  // Niente modifica qui (solo caricamento/eliminazione): il modulo di
  // caricamento compare solo su richiesta esplicita ("+ Nuovo file"),
  // altrimenti arrivando qui da loggati si vedrebbe sempre un modulo di
  // upload aperto anche senza aver chiesto di caricare nulla.
  const inFormMode = nuovo === "1";
  const elenco = await getCarteIntestate();

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Carta Intestata</h1>
            <p>Carica documenti e immagini (loghi, modelli) scaricabili da tutti dalla Carta Intestata.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/carta-intestata" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/carta-intestata?nuovo=1" className="btn btn--primary btn--sm">
              + Nuovo file
            </Link>
          )}
        </div>
      </header>

      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>Nuovo file</h2>
        <form action={saveCartaIntestata} className="form">
          <div className="field">
            <label htmlFor="titolo">Titolo</label>
            <input id="titolo" name="titolo" className="input" required placeholder="Es. Carta intestata Comune, Logo ufficiale…" />
          </div>
          <div className="field">
            <label htmlFor="file">File (documento o immagine)</label>
            <input id="file" name="file" type="file" className="input" required />
          </div>
          <div>
            <button type="submit" className="btn btn--primary">Carica file</button>
          </div>
        </form>
      </div>
      )}

      {!inFormMode && (
      elenco.length === 0 ? (
        <div className="card empty">Nessun file caricato.</div>
      ) : (
        <ul className="admin-list">
          {elenco.map((f) => (
            <li key={f.id} className="card admin-row">
              <span style={{ fontSize: "1.3rem" }}>{f.mime.startsWith("image/") ? "🖼️" : "📃"}</span>
              <div className="admin-row__main">
                <div className="admin-row__title">{f.titolo}</div>
                <div className="admin-row__sub">{f.mime}</div>
              </div>
              <div className="admin-row__actions">
                <a href={f.fileUrl} className="btn btn--ghost btn--sm">
                  Scarica
                </a>
                <form action={removeCartaIntestata} className="inline-form">
                  <input type="hidden" name="id" value={f.id} />
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
