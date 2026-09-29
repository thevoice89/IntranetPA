import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFormazioneAttivitaContatto, getContatto, getAnagraficaPrivata } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import { oggiIso as oggiIsoRoma } from "@/lib/format";
import { MODALITA_FRUIZIONE, AREE_TEMATICHE } from "@/lib/formazione-opzioni";
import { salvaAttivitaFormazione, rimuoviAttivitaFormazione } from "./actions";
import CertificazioneAttestatoField from "./CertificazioneAttestatoField";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  nocontatto:
    "Il tuo account non è collegato a un nominativo in rubrica: contatta l'amministratore per poter registrare le tue attività formative.",
  descrizione: "Indica la descrizione del percorso formativo.",
  campi: "Compila tutti i campi obbligatori (tutti tranne l'area tematica).",
  permesso: "Operazione non consentita.",
  attestato: "Carica l'attestato: è obbligatorio quando spunti la certificazione delle competenze.",
};

export default async function LeMieAttivitaFormazione({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { edit, error } = await searchParams;

  if (!user.contattoId) {
    return (
      <section>
        <header className="page-header">
          <Link href={ROUTES.formazione.path} className="help">← Formazione</Link>
          <h1>{ROUTES.formazioneAttivita.label}</h1>
        </header>
        <div className="alert">{ERRORI.nocontatto}</div>
      </section>
    );
  }

  const [attivita, contatto, anagrafica] = await Promise.all([
    getFormazioneAttivitaContatto(user.contattoId),
    getContatto(user.contattoId),
    getAnagraficaPrivata(user.contattoId),
  ]);
  const inModifica = edit ? attivita.find((a) => a.id === edit) ?? null : null;
  const totaleOreSvolte = attivita.reduce((tot, a) => tot + a.oreSvolte, 0);
  const oggiIso = oggiIsoRoma();

  return (
    <section>
      <header className="page-header">
        <Link href={ROUTES.formazione.path} className="help">← Formazione</Link>
        <h1>{ROUTES.formazioneAttivita.label}</h1>
        <p>
          {contatto?.nome ?? user.username} · {attivita.length} corso
          {attivita.length === 1 ? "" : "i"} registrat
          {attivita.length === 1 ? "o" : "i"} · {totaleOreSvolte} ore svolte totali
        </p>
        {anagrafica && (anagrafica.categoriaLavoro || anagrafica.eta != null) && (
          <p className="help">
            {anagrafica.categoriaLavoro}
            {anagrafica.categoriaLavoro && anagrafica.eta != null && " · "}
            {anagrafica.eta != null && `${anagrafica.eta} anni`}
          </p>
        )}
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Operazione non valida."}</div>}

      <div className="formazione-layout">
        <div>
          {attivita.length === 0 ? (
            <div className="card empty">Nessuna attività registrata ancora.</div>
          ) : (
            <ul className="admin-list">
              {attivita.map((a) => (
                <li key={a.id} className="card admin-row">
                  <div className="admin-row__main">
                    <div className="admin-row__title">{a.descrizionePercorso}</div>
                    <div className="admin-row__sub">
                      {a.enteErogatore && `${a.enteErogatore} · `}
                      {a.dataCorso} · {a.oreSvolte}/{a.orePreviste} ore
                      {a.modalitaFruizione && ` · ${a.modalitaFruizione}`}
                      {a.areaTematica && ` · ${a.areaTematica}`}
                      {a.certificazioneCompetenze && " · ✅ certificazione competenze"}
                      {a.attestatoUrl && " · 📎 attestato"}
                    </div>
                  </div>
                  <div className="admin-row__actions">
                    <Link href={`/formazione/le-mie-attivita?edit=${a.id}`} className="btn btn--ghost btn--sm">
                      Modifica
                    </Link>
                    <form action={rimuoviAttivitaFormazione} className="inline-form">
                      <input type="hidden" name="id" value={a.id} />
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

        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
            {inModifica ? `Modifica corso` : "Aggiungi un corso"}
          </h2>
          <form key={inModifica?.id ?? "new"} action={salvaAttivitaFormazione} className="form">
            <input type="hidden" name="id" value={inModifica?.id ?? ""} />
            <input type="hidden" name="redirectTo" value="/formazione/le-mie-attivita" />
            <div className="field">
              <label htmlFor="descrizionePercorso">Descrizione percorso formativo</label>
              <textarea
                id="descrizionePercorso"
                name="descrizionePercorso"
                className="textarea"
                required
                rows={2}
                placeholder="Es. Corso sulla sicurezza sul lavoro"
                defaultValue={inModifica?.descrizionePercorso ?? ""}
              />
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="enteErogatore">Ente erogante</label>
                <input
                  id="enteErogatore"
                  name="enteErogatore"
                  className="input"
                  required
                  placeholder="Es. Formez PA, interno, ..."
                  defaultValue={inModifica?.enteErogatore ?? ""}
                />
              </div>
              <div className="field">
                <label htmlFor="dataCorso">Data corso</label>
                <input
                  id="dataCorso"
                  name="dataCorso"
                  type="date"
                  className="input"
                  required
                  defaultValue={inModifica?.dataCorso ?? oggiIso}
                />
              </div>
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="orePreviste">Ore previste</label>
                <input
                  id="orePreviste"
                  name="orePreviste"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  required
                  defaultValue={inModifica?.orePreviste ?? ""}
                />
              </div>
              <div className="field">
                <label htmlFor="oreSvolte">Ore svolte</label>
                <input
                  id="oreSvolte"
                  name="oreSvolte"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  required
                  defaultValue={inModifica?.oreSvolte ?? ""}
                />
              </div>
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="modalitaFruizione">Modalità di fruizione</label>
                <select
                  id="modalitaFruizione"
                  name="modalitaFruizione"
                  className="select"
                  required
                  defaultValue={inModifica?.modalitaFruizione ?? ""}
                >
                  <option value="">— seleziona —</option>
                  {MODALITA_FRUIZIONE.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="areaTematica">Area tematica (facoltativa)</label>
                <select
                  id="areaTematica"
                  name="areaTematica"
                  className="select"
                  defaultValue={inModifica?.areaTematica ?? ""}
                >
                  <option value="">— seleziona —</option>
                  {AREE_TEMATICHE.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <CertificazioneAttestatoField
              key={inModifica?.id ?? "new"}
              defaultChecked={inModifica?.certificazioneCompetenze ?? false}
              attestatoUrl={inModifica?.attestatoUrl ?? null}
              attestatoNomeOriginale={inModifica?.attestatoNomeOriginale ?? null}
            />
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="submit" className="btn btn--primary">
                {inModifica ? "Salva modifiche" : "Aggiungi"}
              </button>
              {inModifica && (
                <Link href="/formazione/le-mie-attivita" className="btn btn--ghost">
                  Annulla
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
