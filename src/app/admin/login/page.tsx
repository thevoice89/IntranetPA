import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/admin/actions";
import { percorsoInterno } from "@/lib/ritorno-login";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Pagina da cui si arriva (?next=, vedi lib/ritorno-login.ts): dopo
  // l'accesso si torna lì. Senza, si apre la dashboard come prima.
  const destinazione = percorsoInterno(next);
  if (await getCurrentUser()) redirect(destinazione ?? "/admin");

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Area Amministrazione</h1>
        <p>Accedi con le tue credenziali per gestire i contenuti.</p>

        {error === "troppi" ? (
          <div className="alert">Troppi tentativi falliti. Riprova tra qualche minuto.</div>
        ) : (
          error && <div className="alert">Credenziali non valide. Riprova.</div>
        )}

        <form action={loginAction} className="form">
          {destinazione && <input type="hidden" name="next" value={destinazione} />}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" className="input" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" required />
          </div>
          <button type="submit" className="btn btn--primary">
            Accedi
          </button>
        </form>
      </div>
    </div>
  );
}
