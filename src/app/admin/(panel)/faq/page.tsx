import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditProcedure } from "@/lib/auth";
import { getFaq, getFaqUnica, getProcedure } from "@/lib/data";
import { saveFaq, removeFaq } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminFaq({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  const { edit, nuovo } = await searchParams;
  // Il modulo compare solo su richiesta esplicita (matita o "+ Nuova FAQ"):
  // altrimenti, arrivando qui da loggati, si vedrebbe sempre un modulo aperto
  // in creazione anche senza aver chiesto di creare o modificare nulla.
  const inFormMode = Boolean(edit) || nuovo === "1";
  const [faq, procedure] = await Promise.all([getFaq(), getProcedure()]);
  const inModifica = edit ? await getFaqUnica(edit) : null;

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>FAQ</h1>
            <p>Domande frequenti, con link facoltativo a una procedura. Cercabili dal sito.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/faq" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/faq?nuovo=1" className="btn btn--primary btn--sm">
              + Nuova FAQ
            </Link>
          )}
        </div>
      </header>

      {/* --- Form crea/modifica (solo su richiesta, vedi inFormMode sopra) --- */}
      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.domanda}` : "Nuova FAQ"}
        </h2>
        <form key={inModifica?.id ?? "new"} action={saveFaq} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />

          <div className="field">
            <label htmlFor="domanda">Domanda</label>
            <input
              id="domanda"
              name="domanda"
              className="input"
              required
              defaultValue={inModifica?.domanda ?? ""}
            />
          </div>

          <div className="field">
            <label htmlFor="risposta">Risposta</label>
            <textarea
              id="risposta"
              name="risposta"
              className="textarea"
              rows={5}
              defaultValue={inModifica?.risposta ?? ""}
            />
          </div>

          <div className="field">
            <label htmlFor="categoria">Categoria</label>
            <input
              id="categoria"
              name="categoria"
              className="input"
              placeholder="Generale"
              defaultValue={inModifica?.categoria ?? ""}
            />
          </div>

          <div className="field">
            <label htmlFor="proceduraId">Procedura collegata (facoltativa)</label>
            <select
              id="proceduraId"
              name="proceduraId"
              className="select"
              defaultValue={inModifica?.proceduraId ?? ""}
            >
              <option value="">Nessuna</option>
              {procedure.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titolo}{!p.pubblicato ? " (bozza)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--check">
            <input
              id="pubblicato"
              name="pubblicato"
              type="checkbox"
              defaultChecked={inModifica?.pubblicato ?? false}
            />
            <label htmlFor="pubblicato">Pubblicata (visibile sul sito)</label>
          </div>

          <div>
            <button type="submit" className="btn btn--primary">
              {inModifica ? "Salva modifiche" : "Crea FAQ"}
            </button>
            {inModifica?.pubblicato && (
              <a
                href="/faq"
                target="_blank"
                rel="noreferrer"
                className="help"
                style={{ marginLeft: "1rem" }}
              >
                Vedi FAQ pubbliche ↗
              </a>
            )}
          </div>
        </form>
      </div>
      )}

      {/* --- Elenco (nascosto mentre si crea/modifica, vedi inFormMode sopra) --- */}
      {!inFormMode && (
      faq.length === 0 ? (
        <div className="card empty">Nessuna FAQ.</div>
      ) : (
        <ul className="admin-list">
          {faq.map((f) => (
            <li key={f.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {f.domanda}{" "}
                  {!f.pubblicato && <span className="badge">bozza</span>}
                </div>
                <div className="admin-row__sub">
                  {[f.categoria, f.proceduraTitolo && `→ ${f.proceduraTitolo}`]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="admin-row__actions">
                <Link
                  href={`/admin/faq?edit=${f.id}`}
                  className="btn btn--ghost btn--sm"
                >
                  Modifica
                </Link>
                <form action={removeFaq} className="inline-form">
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="btn btn--danger btn--sm">
                    Elimina
                  </button>
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
