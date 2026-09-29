import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEditFormazioneAvviso, canEdit } from "@/lib/auth";
import { getFormazioneAvviso, getContatti } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import {
  salvaAvvisoFormazione,
  rimuoviAllegatoAvviso,
  rimuoviAvvisoFormazione,
} from "@/app/(site)/formazione/avvisi/actions";
import PubblicaNotiziaFormazioneCheckbox from "@/components/admin/PubblicaNotiziaFormazioneCheckbox";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  titolo: "Inserisci un titolo.",
  descrizione: "Scrivi una breve descrizione.",
  permesso: "Operazione non consentita.",
  autoreFormazione: "Seleziona un nominativo dalla rubrica per l'autore della notizia di Formazione.",
};

export default async function NuovoAvvisoFormazione({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { edit, error } = await searchParams;

  const esistente = edit ? await getFormazioneAvviso(edit) : null;
  if (edit && (!esistente || !canEditFormazioneAvviso(user, esistente))) {
    redirect("/formazione/avvisi");
  }

  const contatti = await getContatti();
  const puoPubblicareNotiziaFormazione = !esistente && canEdit(user, "formazione");

  return (
    <section>
      <header className="page-header">
        <Link href={ROUTES.formazioneAvvisi.path} className="help">← Avvisi e opportunità formative</Link>
        <h1>{esistente ? "Modifica avviso" : "Nuovo avviso"}</h1>
        <p>Titolo, descrizione ed eventuali allegati o link: sarà visibile a tutti i colleghi.</p>
      </header>

      <div className="card" style={{ padding: "1.5rem", maxWidth: 640 }}>
        {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

        {/* id + attributo form sul pulsante: come nell'editor admin delle
            comunicazioni, il tasto "Pubblica"/"Salva" sta fuori da questo
            <form> (sotto il riquadro allegati, che contiene a sua volta dei
            form per rimuoverli — form annidati non sono markup valido).
            L'attributo form="..." lo rilega comunque a questo form. */}
        <form
          id="form-avviso"
          key={esistente?.id ?? "new"}
          action={salvaAvvisoFormazione}
          className="form"
          encType="multipart/form-data"
        >
          <input type="hidden" name="id" value={esistente?.id ?? ""} />
          <div className="field">
            <label htmlFor="titolo">Titolo</label>
            <input
              id="titolo"
              name="titolo"
              className="input"
              required
              defaultValue={esistente?.titolo ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="descrizione">Descrizione</label>
            <textarea
              id="descrizione"
              name="descrizione"
              className="textarea"
              rows={6}
              required
              defaultValue={esistente?.descrizione ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="file">Allega uno o più file (opzionale)</label>
            <input id="file" name="file" type="file" className="input" multiple />
          </div>
          <div className="field--row">
            <div className="field">
              <label htmlFor="link">Link (opzionale)</label>
              <input id="link" name="link" className="input" placeholder="https://..." />
            </div>
            <div className="field">
              <label htmlFor="linkEtichetta">Etichetta del link (opzionale)</label>
              <input id="linkEtichetta" name="linkEtichetta" className="input" placeholder="Es. Iscrizioni" />
            </div>
          </div>
          {puoPubblicareNotiziaFormazione && <PubblicaNotiziaFormazioneCheckbox contatti={contatti} />}
        </form>

        {esistente && esistente.allegati && esistente.allegati.length > 0 && (
          <div className="field">
            <label>Allegati attuali</label>
            <ul className="admin-list">
              {esistente.allegati.map((a) => (
                <li key={a.id} className="card admin-row">
                  <span>{a.tipo === "file" ? "📎" : "🔗"}</span>
                  <div className="admin-row__main">
                    <div className="admin-row__title">{a.etichetta}</div>
                  </div>
                  <div className="admin-row__actions">
                    <a href={a.url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                      Apri
                    </a>
                    <form action={rimuoviAllegatoAvviso} className="inline-form">
                      <input type="hidden" name="avvisoId" value={esistente.id} />
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="btn btn--danger btn--sm">Rimuovi</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
          <button type="submit" form="form-avviso" className="btn btn--primary">
            {esistente ? "Salva modifiche" : "Pubblica"}
          </button>
          <Link href={ROUTES.formazioneAvvisi.path} className="btn btn--ghost">
            Annulla
          </Link>
        </div>

        {esistente && (
          <form action={rimuoviAvvisoFormazione} className="inline-form" style={{ marginTop: "0.75rem" }}>
            <input type="hidden" name="id" value={esistente.id} />
            <button type="submit" className="btn btn--danger btn--sm">Elimina avviso</button>
          </form>
        )}
      </div>
    </section>
  );
}
