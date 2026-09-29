import { redirect } from "next/navigation";
import { requireUser, canManageSegnalazioni } from "@/lib/auth";
import { listSegnalazioni, getImpostazioni } from "@/lib/data";
import {
  markSegnalazione,
  removeSegnalazione,
  rispondiSegnalazione,
  salvaEmailNotificaSegnalazioni,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

function formatDataOra(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export default async function AdminSegnalazioni({
  searchParams,
}: {
  searchParams: Promise<{ emailError?: string }>;
}) {
  const user = await requireUser();
  if (!canManageSegnalazioni(user)) redirect("/admin");
  const { emailError } = await searchParams;
  const [segnalazioni, impostazioni] = await Promise.all([listSegnalazioni(), getImpostazioni()]);
  const nonLette = segnalazioni.filter((s) => !s.letta).length;

  return (
    <section>
      <header className="page-header">
        <h1>Suggerimenti e segnalazioni</h1>
        <p>
          {segnalazioni.length} messaggi · {nonLette} da leggere
        </p>
      </header>

      <div className="card" style={{ padding: "1.2rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Notifica email</h2>
        <p className="help" style={{ marginBottom: "0.9rem" }}>
          Quando arriva una nuova segnalazione, viene inviata un&apos;email di avviso a questo
          indirizzo. Lascia vuoto per non inviare nulla.
        </p>
        <form action={salvaEmailNotificaSegnalazioni} className="form">
          <div className="field">
            <label htmlFor="emailNotifica">Email destinatario</label>
            <input
              id="emailNotifica"
              name="emailNotifica"
              type="email"
              multiple
              className="input"
              defaultValue={impostazioni["email_notifica_segnalazioni"] ?? ""}
              placeholder="es. protocollo@comune.esempio.it"
            />
          </div>
          <p className="help">Per più destinatari, separa gli indirizzi con una virgola.</p>
          <button type="submit" className="btn btn--primary btn--sm">Salva</button>
        </form>
      </div>

      {segnalazioni.length === 0 ? (
        <div className="card empty">Nessuna segnalazione ricevuta.</div>
      ) : (
        <ul className="comm-list">
          {segnalazioni.map((s) => (
            <li
              key={s.id}
              className="card comm-item"
              style={!s.letta ? { borderLeft: "3px solid var(--accent)" } : undefined}
            >
              <details open={!s.letta || emailError === s.id}>
                <summary style={{ cursor: "pointer" }}>
                  <span className="comm-item__meta" style={{ margin: 0, display: "inline-flex" }}>
                    {!s.letta && <span className="badge">Nuovo</span>}
                    <strong>{s.autore || "Anonimo"}</strong>
                    <span>·</span>
                    <span>{formatDataOra(s.creatoIl)}</span>
                    {s.rispostaTesto && (
                      <>
                        <span>·</span>
                        <span className="badge">Risposto</span>
                      </>
                    )}
                  </span>
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      marginTop: "0.3rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.testo}
                  </span>
                </summary>

                <div style={{ marginTop: "0.8rem" }}>
                  <div className="comm-item__meta" style={{ margin: 0 }}>
                    {s.autoreEmail ? (
                      <span className="help">Risponderà via email a {s.autoreEmail}</span>
                    ) : (
                      <span className="badge">Email non disponibile</span>
                    )}
                    {s.userId && (
                      <>
                        <span>·</span>
                        <span className="badge">Utente registrato</span>
                      </>
                    )}
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{s.testo}</p>

                  {s.rispostaTesto && (
                    <div className="commento-item" style={{ marginTop: "0.8rem" }}>
                      <div className="commento-item__meta">
                        <strong>La tua risposta</strong>
                        <span>·</span>
                        <span>{s.rispostaData ? formatDataOra(s.rispostaData) : ""}</span>
                        {s.autoreEmail && (
                          <>
                            <span>·</span>
                            <span>{s.rispostaEmailInviataIl ? "email inviata" : "email non ancora inviata"}</span>
                          </>
                        )}
                      </div>
                      <p style={{ whiteSpace: "pre-wrap", marginTop: "0.3rem" }}>{s.rispostaTesto}</p>
                    </div>
                  )}

                  {emailError === s.id && (
                    <div className="alert" style={{ marginTop: "0.8rem" }}>
                      L&apos;invio dell&apos;email di risposta non è riuscito. La risposta resta
                      salvata: reinviandola si riprova automaticamente.
                    </div>
                  )}

                  <form action={rispondiSegnalazione} className="form" style={{ marginTop: "0.8rem" }}>
                    <input type="hidden" name="id" value={s.id} />
                    <div className="field">
                      <textarea
                        name="risposta"
                        className="textarea"
                        rows={3}
                        placeholder="Scrivi una risposta…"
                        defaultValue={s.rispostaTesto ?? ""}
                      />
                    </div>
                    <button type="submit" className="btn btn--primary btn--sm">
                      {s.rispostaTesto ? "Aggiorna risposta" : "Invia risposta"}
                    </button>
                  </form>

                  <div className="admin-row__actions" style={{ marginTop: "0.8rem" }}>
                    <form action={markSegnalazione} className="inline-form">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="letta" value={(!s.letta).toString()} />
                      <button type="submit" className="btn btn--ghost btn--sm">
                        {s.letta ? "Segna come da leggere" : "Segna come letta"}
                      </button>
                    </form>
                    <form action={removeSegnalazione} className="inline-form">
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
