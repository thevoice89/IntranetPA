import { ROUTES } from "@/lib/routes";
import { getContatti } from "@/lib/data";
import { inviaSegnalazione } from "@/app/(site)/suggerimenti/actions";
import ContattoField from "@/components/ui/ContattoField";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  testo: "Scrivi un messaggio prima di inviare.",
  contatto: "Seleziona il tuo nominativo dalla rubrica prima di inviare.",
};

export default async function SuggerimentiPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const contatti = await getContatti();

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.suggerimenti.label}</h1>
        <p>
          Hai un&apos;idea, un suggerimento o vuoi segnalare un problema?
          Scrivici: leggiamo tutto.
        </p>
      </header>

      <div className="card" style={{ padding: "1.5rem", maxWidth: 640 }}>
        {ok && (
          <div className="notice notice--ok">
            Grazie! La tua segnalazione è stata inviata.
          </div>
        )}
        {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

        <form action={inviaSegnalazione} className="form">
          <div className="field">
            <label htmlFor="testo">Il tuo messaggio</label>
            <textarea
              id="testo"
              name="testo"
              className="textarea"
              rows={6}
              placeholder="Scrivi qui il tuo suggerimento o la tua segnalazione…"
              required
            />
          </div>
          <ContattoField contatti={contatti} />
          <div>
            <button type="submit" className="btn btn--primary">Invia</button>
          </div>
        </form>
      </div>
    </section>
  );
}
