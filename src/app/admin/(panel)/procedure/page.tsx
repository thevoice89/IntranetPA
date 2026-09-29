import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditProcedure, canEdit } from "@/lib/auth";
import { getProcedure, getProcedura, listUffici, getContatti } from "@/lib/data";
import { saveProcedura, removeProcedura } from "@/app/admin/actions";
import ReferentePicker from "@/components/admin/ReferentePicker";
import UfficioPicker from "@/components/admin/UfficioPicker";
import PubblicaNotiziaCheckbox from "@/components/admin/PubblicaNotiziaCheckbox";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  autore: "Seleziona un nominativo dalla rubrica per l'autore della comunicazione ufficiale.",
};

export default async function AdminProcedure({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  const { edit, error, nuovo } = await searchParams;
  // Il modulo compare solo su richiesta esplicita (matita, "+ Nuova procedura"
  // o un redirect di errore, che perde ?edit= — vedi saveProcedura in
  // admin/actions.ts): altrimenti, arrivando qui da loggati, si vedrebbe
  // sempre un modulo aperto anche senza aver chiesto di creare o modificare
  // nulla.
  const inFormMode = Boolean(edit) || nuovo === "1" || Boolean(error);
  const [procedure, uffici, contatti] = await Promise.all([
    getProcedure(),
    listUffici(),
    getContatti(),
  ]);
  const inModifica = edit ? await getProcedura(edit) : null;
  const puoPubblicareNotizia = canEdit(user, "ufficiale");

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Procedure</h1>
            <p>Per ogni procedura: ufficio e referente. Cercabile dal sito.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/procedure" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/procedure?nuovo=1" className="btn btn--primary btn--sm">
              + Nuova procedura
            </Link>
          )}
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      {/* --- Form crea/modifica (solo su richiesta, vedi inFormMode sopra) --- */}
      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.titolo}` : "Nuova procedura"}
        </h2>
        <form key={inModifica?.id ?? "new"} action={saveProcedura} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />

          <div className="field">
            <label htmlFor="titolo">Titolo (parola cercata, es. &quot;Posta&quot;)</label>
            <input
              id="titolo"
              name="titolo"
              className="input"
              required
              defaultValue={inModifica?.titolo ?? ""}
            />
          </div>

          <UfficioPicker
            uffici={uffici}
            defaultUfficioId={inModifica?.ufficioId ?? undefined}
            label="Ufficio che la esegue"
          />

          <ReferentePicker
            contatti={contatti}
            defaultReferente={inModifica?.referente ?? ""}
            defaultContatto={inModifica?.referenteContatto ?? ""}
          />

          <div className="field">
            <label htmlFor="descrizione">Descrizione / come si fa</label>
            <textarea
              id="descrizione"
              name="descrizione"
              className="textarea"
              rows={5}
              defaultValue={inModifica?.descrizione ?? ""}
            />
          </div>

          <div className="field">
            <label htmlFor="url">Link di approfondimento (facoltativo)</label>
            <input
              id="url"
              name="url"
              className="input"
              placeholder="https://…"
              defaultValue={inModifica?.url ?? ""}
            />
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

          {!inModifica && puoPubblicareNotizia && (
            <PubblicaNotiziaCheckbox contatti={contatti} />
          )}

          <div>
            <button type="submit" className="btn btn--primary">
              {inModifica ? "Salva modifiche" : "Crea procedura"}
            </button>
            {inModifica?.pubblicato && (
              <a
                href={`/procedure/${inModifica.id}`}
                target="_blank"
                rel="noreferrer"
                className="help"
                style={{ marginLeft: "1rem" }}
              >
                Vedi procedura pubblica ↗
              </a>
            )}
          </div>
        </form>
      </div>
      )}

      {/* --- Elenco (nascosto mentre si crea/modifica, vedi inFormMode sopra) --- */}
      {!inFormMode && (
      procedure.length === 0 ? (
        <div className="card empty">Nessuna procedura.</div>
      ) : (
        <ul className="admin-list">
          {procedure.map((p) => (
            <li key={p.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {p.titolo}{" "}
                  {!p.pubblicato && <span className="badge">bozza</span>}
                </div>
                <div className="admin-row__sub">
                  {[p.ufficioNome, p.referente && `ref. ${p.referente}`]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="admin-row__actions">
                <Link
                  href={`/admin/procedure?edit=${p.id}`}
                  className="btn btn--ghost btn--sm"
                >
                  Modifica
                </Link>
                <form action={removeProcedura} className="inline-form">
                  <input type="hidden" name="id" value={p.id} />
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
