import Link from "next/link";
import { getContatti } from "@/lib/data";
import { pubblicaComunicazione } from "@/app/(site)/comunicazioni-non-ufficiali/actions";
import ContattoField from "@/components/ui/ContattoField";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  titolo: "Inserisci un titolo.",
  corpo: "Scrivi il testo della comunicazione.",
  contatto: "Seleziona il tuo nominativo dalla rubrica prima di pubblicare.",
};

export default async function NuovaComunicazioneNonUfficiale({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const contatti = await getContatti();

  return (
    <section>
      <header className="page-header">
        <Link href="/comunicazioni-non-ufficiali" className="help">← Comunicazioni Non Ufficiali</Link>
        <h1>Nuova comunicazione</h1>
        <p>Scrivi un annuncio per la bacheca informale: lo vedranno tutti i colleghi.</p>
      </header>

      <div className="card" style={{ padding: "1.5rem", maxWidth: 640 }}>
        {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

        <form action={pubblicaComunicazione} className="form">
          <div className="field">
            <label htmlFor="titolo">Titolo</label>
            <input id="titolo" name="titolo" className="input" required />
          </div>
          <div className="field">
            <label htmlFor="corpo">Testo</label>
            <textarea id="corpo" name="corpo" className="textarea" rows={6} required />
          </div>
          <div className="field">
            <label htmlFor="file">Allega un file (opzionale)</label>
            <input id="file" name="file" type="file" className="input" />
          </div>

          <ContattoField contatti={contatti} storageKey="comunicazioni:contattoId" />

          <div>
            <button type="submit" className="btn btn--primary">Pubblica</button>
          </div>
        </form>
      </div>
    </section>
  );
}
