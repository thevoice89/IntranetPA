import { requireUser } from "@/lib/auth";
import { cambiaPassword } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  attuale: "Password attuale errata.",
  corta: "La nuova password deve essere di almeno 8 caratteri.",
  conferma: "La conferma non coincide con la nuova password.",
};

export default async function AdminPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { error, ok } = await searchParams;

  return (
    <section>
      <header className="page-header">
        <h1>Cambia password</h1>
        <p>Aggiorna la password del tuo account ({user.username}).</p>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}
      {ok && (
        <p style={{ marginBottom: "1rem" }}>
          <span className="badge">Password aggiornata</span>
        </p>
      )}

      <div className="card" style={{ padding: "1.5rem", maxWidth: 420 }}>
        <form action={cambiaPassword} className="form">
          <div className="field">
            <label htmlFor="attuale">Password attuale</label>
            <input
              id="attuale"
              name="attuale"
              type="password"
              className="input"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="nuova">Nuova password</label>
            <input
              id="nuova"
              name="nuova"
              type="password"
              className="input"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="conferma">Conferma nuova password</label>
            <input
              id="conferma"
              name="conferma"
              type="password"
              className="input"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <button type="submit" className="btn btn--primary">Salva</button>
          </div>
        </form>
      </div>
    </section>
  );
}
