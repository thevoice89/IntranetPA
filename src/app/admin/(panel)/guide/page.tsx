import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditGuide, canEdit } from "@/lib/auth";
import { getGuide, getGuida, getCategorieGuide, getContatti } from "@/lib/data";
import { removeGuida, removeGuidaMateriale } from "@/app/admin/actions";
import { GuidaForm } from "@/components/admin/GuidaForm";
import AddMaterialeForm from "@/components/admin/AddMaterialeForm";

export const dynamic = "force-dynamic";

const TIPO_ICONA: Record<string, string> = {
  documento: "📄",
  link: "🔗",
  video: "🎬",
};

const ERRORI: Record<string, string> = {
  autoreFormazione: "Seleziona un nominativo dalla rubrica per l'autore della notizia di Formazione.",
};

export default async function AdminGuide({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditGuide(user)) redirect("/admin");
  const { edit, error, nuovo } = await searchParams;
  // Il modulo compare solo su richiesta esplicita (matita, "+ Nuovo argomento"
  // o un redirect di errore, che perde ?edit= — vedi saveGuida in
  // admin/actions.ts): altrimenti, arrivando qui da loggati, si vedrebbe
  // sempre un modulo aperto anche senza aver chiesto di creare o modificare
  // nulla.
  const inFormMode = Boolean(edit) || nuovo === "1" || Boolean(error);
  const [guide, categorie, contatti] = await Promise.all([
    getGuide(),
    getCategorieGuide(),
    getContatti(),
  ]);
  const inModifica = edit ? await getGuida(edit) : null;
  const puoPubblicareNotiziaFormazione = canEdit(user, "formazione");

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Formazione dei colleghi per i colleghi</h1>
            <p>Argomenti con documenti, link e video — pubblici in Formazione.</p>
          </div>
          {inFormMode ? (
            <Link href="/admin/guide" className="btn btn--ghost btn--sm">
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link href="/admin/guide?nuovo=1" className="btn btn--primary btn--sm">
              + Nuovo argomento
            </Link>
          )}
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      {/* --- Form crea / modifica argomento (solo su richiesta, vedi
          inFormMode sopra) --- */}
      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.titolo}` : "Nuovo argomento"}
        </h2>
        <GuidaForm
          guida={inModifica}
          categorie={categorie}
          contatti={contatti}
          puoPubblicareNotiziaFormazione={puoPubblicareNotiziaFormazione}
        />
      </div>
      )}

      {/* --- Gestione materiali (solo in modalità modifica) --- */}
      {inModifica && (
        <>
          <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
              Materiali ({inModifica.materiali.length})
            </h2>

            {inModifica.materiali.length === 0 ? (
              <p className="help">Nessun materiale ancora. Aggiungine uno qui sotto.</p>
            ) : (
              <ul className="admin-list">
                {inModifica.materiali.map((m) => (
                  <li key={m.id} className="card admin-row">
                    <div className="admin-row__main">
                      <div className="admin-row__title">
                        {TIPO_ICONA[m.tipo]}{" "}
                        {m.titolo || "—"}
                        <span className="badge badge--tipo" style={{ marginLeft: "0.4rem" }}>
                          {m.tipo}
                        </span>
                      </div>
                    </div>
                    <div className="admin-row__actions">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--ghost btn--sm"
                      >
                        Apri
                      </a>
                      <form action={removeGuidaMateriale} className="inline-form">
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="guidaId" value={inModifica.id} />
                        <button type="submit" className="btn btn--danger btn--sm">
                          Elimina
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
              Aggiungi materiale
            </h2>
            <AddMaterialeForm guidaId={inModifica.id} />
          </div>
        </>
      )}

      {/* --- Elenco argomenti (solo quando non si è in modifica/creazione,
          vedi inFormMode sopra) --- */}
      {!inFormMode && (
        guide.length === 0 ? (
          <div className="card empty">Nessun argomento.</div>
        ) : (
          <ul className="admin-list">
            {guide.map((g) => (
              <li key={g.id} className="card admin-row">
                <div className="admin-row__main">
                  <div className="admin-row__title">{g.titolo}</div>
                  <div className="admin-row__sub">
                    {g.categoria}
                    {g.materiali.length > 0 &&
                      ` · ${g.materiali.length} materiale${g.materiali.length !== 1 ? "i" : ""}`}
                  </div>
                </div>
                <div className="admin-row__actions">
                  <Link href={`/admin/guide?edit=${g.id}`} className="btn btn--ghost btn--sm">
                    Modifica
                  </Link>
                  <form action={removeGuida} className="inline-form">
                    <input type="hidden" name="id" value={g.id} />
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
