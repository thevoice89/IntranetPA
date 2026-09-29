import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canEdit, canEditAny, canEditComunicazioneItem } from "@/lib/auth";
import { getComunicazioni, getComunicazione, listUffici, getSondaggi, getContatti } from "@/lib/data";
import {
  saveComunicazione,
  removeComunicazione,
  addAllegatoLink,
  uploadAllegatoFile,
  removeAllegato,
} from "@/app/admin/actions";
import type { TipoComunicazione } from "@/types";
import { formatData, mostraInEvidenza, oggiIso } from "@/lib/format";
import { corpoComunicazioneHtml } from "@/lib/rich-text";
import { ComunicazioneCampiPrincipali } from "@/components/admin/ComunicazioneCampiPrincipali";
import CorpoComunicazione from "@/components/admin/CorpoComunicazione";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<TipoComunicazione, string> = {
  ufficiale: "Ufficiale",
  non_ufficiale: "Non ufficiale",
  rsu: "RSU",
  sicurezza: "Sicurezza sul lavoro",
  eventi: "Eventi",
  formazione: "Notizie Formazione",
};

const ERRORI: Record<string, string> = {
  autore: "Le comunicazioni ufficiali, RSU, Sicurezza sul lavoro, Eventi e Notizie Formazione richiedono un nominativo scelto dalla rubrica.",
};

export default async function AdminComunicazioni({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; tipo?: string; error?: string; nuovo?: string }>;
}) {
  const user = await requireUser();
  if (!canEditAny(user)) redirect("/admin");

  const allowed: TipoComunicazione[] = [];
  if (canEdit(user, "ufficiale")) allowed.push("ufficiale");
  if (canEdit(user, "non_ufficiale")) allowed.push("non_ufficiale");
  if (canEdit(user, "rsu")) allowed.push("rsu");
  if (canEdit(user, "sicurezza")) allowed.push("sicurezza");
  if (canEdit(user, "eventi")) allowed.push("eventi");
  if (canEdit(user, "formazione")) allowed.push("formazione");

  const uffici = await listUffici();
  const sondaggi = await getSondaggi();
  const contatti = await getContatti();

  const { edit, tipo, error, nuovo } = await searchParams;
  // Il modulo di creazione/modifica compare solo su richiesta esplicita (matita
  // "Modifica", "+ Nuova" o un redirect di errore dal salvataggio, che perde
  // ?edit= — vedi saveComunicazione in admin/actions.ts): altrimenti, arrivando
  // su questa pagina da loggati, si vedrebbe sempre un modulo aperto anche
  // senza aver chiesto di creare o modificare nulla.
  const inFormMode = Boolean(edit) || nuovo === "1" || Boolean(error);
  const filtro =
    tipo === "ufficiale" ||
    tipo === "non_ufficiale" ||
    tipo === "rsu" ||
    tipo === "sicurezza" ||
    tipo === "eventi" ||
    tipo === "formazione"
      ? (tipo as TipoComunicazione)
      : undefined;

  const tutte = await getComunicazioni();
  const lista = tutte
    .filter((c) => allowed.includes(c.tipo))
    .filter((c) => (filtro ? c.tipo === filtro : true));

  const candidato = edit ? await getComunicazione(edit) : null;
  const inModifica = candidato && canEditComunicazioneItem(user, candidato) ? candidato : null;
  const oggi = oggiIso();
  const defaultTipo = inModifica?.tipo ?? allowed[0];
  const categoriaStorica =
    inModifica && !uffici.some((u) => u.nome === inModifica.categoria) ? inModifica.categoria : null;
  const defaultContattoAutore =
    inModifica &&
    (inModifica.tipo === "rsu" ||
      inModifica.tipo === "ufficiale" ||
      inModifica.tipo === "sicurezza" ||
      inModifica.tipo === "eventi" ||
      inModifica.tipo === "formazione")
      ? contatti.find((c) => c.nome === inModifica.autore) ?? null
      : null;

  return (
    <section>
      <header className="page-header">
        <div className="page-header__row">
          <div>
            <h1>Comunicazioni</h1>
            <p>Gestisci comunicazioni, documentazione e link.</p>
          </div>
          {inFormMode ? (
            <Link
              href={filtro ? `/admin/comunicazioni?tipo=${filtro}` : "/admin/comunicazioni"}
              className="btn btn--ghost btn--sm"
            >
              ← Torna all&apos;elenco
            </Link>
          ) : (
            <Link
              href={filtro ? `/admin/comunicazioni?nuovo=1&tipo=${filtro}` : "/admin/comunicazioni?nuovo=1"}
              className="btn btn--primary btn--sm"
            >
              + Nuova
            </Link>
          )}
        </div>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      {/* --- Form crea/modifica (solo su richiesta, vedi inFormMode sopra) --- */}
      {inFormMode && (
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "1.1rem" }}>
          {inModifica ? `Modifica: ${inModifica.titolo}` : "Nuova comunicazione"}
        </h2>
        {/* key sull'id: senza, passando da "modifica" a "nuova" (o da un record a
            un altro) React riusa gli stessi input e i defaultValue/defaultChecked
            restano quelli del record precedente — spunte comprese. */}
        {/* id + attributo form sul pulsante: il tasto "Salva" sta fuori dal
            <form>, sotto il riquadro degli allegati, perché quel riquadro
            contiene a sua volta dei form (carica file / aggiungi link) e i form
            annidati non sono markup valido. L'attributo form="..." li rilega:
            il pulsante invia comunque questo form. */}
        <form id="form-comunicazione" key={inModifica?.id ?? "new"} action={saveComunicazione} className="form">
          <input type="hidden" name="id" value={inModifica?.id ?? ""} />
          <div className="field">
            <label htmlFor="titolo">Titolo</label>
            <input id="titolo" name="titolo" className="input" required defaultValue={inModifica?.titolo ?? ""} />
          </div>
          <ComunicazioneCampiPrincipali
            allowed={allowed}
            defaultTipo={defaultTipo}
            uffici={uffici}
            defaultCategoria={inModifica?.categoria ?? uffici[0]?.nome ?? ""}
            categoriaStorica={categoriaStorica}
            contatti={contatti}
            defaultAutoreTesto={inModifica?.autore ?? ""}
            defaultContattoAutore={defaultContattoAutore}
            defaultData={inModifica?.data ?? oggi}
          />
          <div className="field">
            <label htmlFor="estratto">Estratto</label>
            <input id="estratto" name="estratto" className="input" defaultValue={inModifica?.estratto ?? ""} />
          </div>
          <div className="field">
            {/* Senza htmlFor: l'editor non è un campo con id ma un'area
                contentEditable, che si presenta da sé con aria-label. */}
            <label>Corpo</label>
            <CorpoComunicazione defaultCorpo={corpoComunicazioneHtml(inModifica?.corpo ?? "")} />
          </div>
          <div className="field field--check">
            <input id="inEvidenza" name="inEvidenza" type="checkbox" defaultChecked={inModifica?.inEvidenza ?? false} />
            <label htmlFor="inEvidenza" style={{ color: "var(--text)" }}>In evidenza</label>
          </div>
          <div className="field--row">
            <div className="field">
              <label htmlFor="promemoriaData">Riporta in evidenza dal</label>
              <input
                id="promemoriaData"
                name="promemoriaData"
                type="date"
                className="input"
                defaultValue={inModifica?.promemoriaData ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="evidenzaFine">Evidenza fino al</label>
              <input
                id="evidenzaFine"
                name="evidenzaFine"
                type="date"
                className="input"
                defaultValue={inModifica?.evidenzaFine ?? ""}
              />
            </div>
          </div>
          <p className="help" style={{ marginTop: "-0.6rem" }}>
            Entrambe facoltative. &quot;Riporta in evidenza dal&quot; fa ricomparire in home una
            comunicazione già pubblicata a partire da quella data (utile per un fatto in
            arrivo, es. un evento fra due settimane) senza dover spuntare &quot;In
            evidenza&quot; da subito; &quot;fino al&quot; ne fissa la scadenza, dopo la quale
            la comunicazione torna nell&apos;elenco normale. Con solo &quot;In evidenza&quot;
            spuntato e nessuna data resta in evidenza senza limiti, come oggi.
          </p>

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="section-title" style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
              Evento e promemoria in calendario
            </legend>
            <div className="field--row">
              <div className="field">
                <label htmlFor="eventoData">Data dell&apos;evento</label>
                <input
                  id="eventoData"
                  name="eventoData"
                  type="date"
                  className="input"
                  defaultValue={inModifica?.eventoData ?? ""}
                />
              </div>
              <div className="field">
                <label htmlFor="eventoOraInizio">Ora inizio</label>
                <input
                  id="eventoOraInizio"
                  name="eventoOraInizio"
                  type="time"
                  className="input"
                  defaultValue={inModifica?.eventoOraInizio ?? ""}
                />
              </div>
              <div className="field">
                <label htmlFor="eventoOraFine">Ora fine</label>
                <input
                  id="eventoOraFine"
                  name="eventoOraFine"
                  type="time"
                  className="input"
                  defaultValue={inModifica?.eventoOraFine ?? ""}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="eventoLuogo">Luogo</label>
              <input
                id="eventoLuogo"
                name="eventoLuogo"
                className="input"
                placeholder="Es. Sala del Consiglio"
                defaultValue={inModifica?.eventoLuogo ?? ""}
              />
            </div>
            <p className="help">
              Tutto facoltativo. Compilando la data, l&apos;evento compare nella pagina della
              comunicazione e finisce nel Calendario del sito, insieme agli eventi inseriti
              dai colleghi: lì lo si trova al giorno giusto, con il rimando a questa
              comunicazione. Orari e luogo sono facoltativi: senza ora di inizio l&apos;evento
              vale per l&apos;intera giornata. Svuotando la data, l&apos;evento sparisce dal
              calendario.
            </p>
          </fieldset>
          <div className="field field--check">
            <input
              id="commentiAbilitati"
              name="commentiAbilitati"
              type="checkbox"
              defaultChecked={inModifica?.commentiAbilitati ?? false}
            />
            <label htmlFor="commentiAbilitati" style={{ color: "var(--text)" }}>
              Abilita commenti (i visitatori possono commentare, visibili subito)
            </label>
          </div>
          <p className="help" style={{ marginTop: "-0.6rem" }}>
            Le comunicazioni RSU hanno sempre i commenti abilitati, indipendentemente da questa spunta.
          </p>
          <div className="field">
            <label htmlFor="sondaggioId">Sondaggio collegato (facoltativo)</label>
            <select
              id="sondaggioId"
              name="sondaggioId"
              className="select"
              defaultValue={inModifica?.sondaggioId ?? ""}
            >
              <option value="">Nessuno</option>
              {sondaggi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titolo}{!s.pubblicato ? " (bozza)" : ""}
                </option>
              ))}
            </select>
            <p className="help">
              Se il sondaggio è pubblicato, nella pagina pubblica della comunicazione comparirà
              un rimando a /sondaggi per parteciparvi. Crea o pubblica sondaggi da &quot;Sondaggi&quot;.
            </p>
          </div>
        </form>

        {/* --- Allegati e link (solo in modifica: prima di poterne caricare
            serve la comunicazione a cui agganciarli) --- */}
        {inModifica ? (
          <>
            <div className="section-title">Allegati e documentazione</div>

            {inModifica.allegati && inModifica.allegati.length > 0 ? (
              <ul className="admin-list" style={{ marginBottom: "1rem" }}>
                {inModifica.allegati.map((a) => (
                  <li key={a.id} className="card admin-row">
                    <span>{a.tipo === "file" ? "📎" : "🔗"}</span>
                    <div className="admin-row__main">
                      <div className="admin-row__title">{a.etichetta}</div>
                      <div className="admin-row__sub">
                        {a.tipo === "file" ? "File caricato" : a.url}
                      </div>
                    </div>
                    <div className="admin-row__actions">
                      <a href={a.url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                        Apri
                      </a>
                      <form action={removeAllegato} className="inline-form">
                        <input type="hidden" name="comunicazioneId" value={inModifica.id} />
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="btn btn--danger btn--sm">Rimuovi</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="help" style={{ marginBottom: "1rem" }}>Nessun allegato.</p>
            )}

            <div className="field--row">
              {/* Carica file */}
              <form action={uploadAllegatoFile} className="form">
                <input type="hidden" name="comunicazioneId" value={inModifica.id} />
                <div className="field">
                  <label htmlFor="file">Carica un file</label>
                  <input id="file" name="file" type="file" className="input" required />
                </div>
                <div className="field">
                  <label htmlFor="etichettaFile">Etichetta (opzionale)</label>
                  <input id="etichettaFile" name="etichetta" className="input" placeholder="Es. Modulo richiesta ferie" />
                </div>
                <button type="submit" className="btn btn--ghost">Carica file</button>
              </form>

              {/* Aggiungi link */}
              <form action={addAllegatoLink} className="form">
                <input type="hidden" name="comunicazioneId" value={inModifica.id} />
                <div className="field">
                  <label htmlFor="url">Link (es. SharePoint)</label>
                  <input id="url" name="url" className="input" placeholder="https://..." required />
                </div>
                <div className="field">
                  <label htmlFor="etichettaLink">Etichetta (opzionale)</label>
                  <input id="etichettaLink" name="etichetta" className="input" placeholder="Es. Cartella SharePoint" />
                </div>
                <button type="submit" className="btn btn--ghost">Aggiungi link</button>
              </form>
            </div>
          </>
        ) : (
          // In creazione la comunicazione non esiste ancora, quindi non c'è un id a
          // cui agganciare gli allegati: questi campi viaggiano insieme al resto del
          // form (attributo form="form-comunicazione", come il pulsante Salva) e
          // vengono agganciati da saveComunicazione subito dopo l'inserimento.
          <>
            <div className="section-title">Allegati e documentazione</div>
            <p className="help" style={{ marginBottom: "1rem" }}>
              Puoi allegare subito un file e un link. Dopo aver creato la comunicazione
              potrai aggiungerne altri e rimuoverli da qui.
            </p>
            <div className="field--row">
              <div className="field">
                <label htmlFor="nuovoFile">Carica un file</label>
                <input
                  id="nuovoFile"
                  name="nuovoFile"
                  type="file"
                  className="input"
                  form="form-comunicazione"
                />
              </div>
              <div className="field">
                <label htmlFor="nuovoFileEtichetta">Etichetta (opzionale)</label>
                <input
                  id="nuovoFileEtichetta"
                  name="nuovoFileEtichetta"
                  className="input"
                  placeholder="Es. Modulo richiesta ferie"
                  form="form-comunicazione"
                />
              </div>
            </div>
            <div className="field--row">
              <div className="field">
                <label htmlFor="nuovoLink">Link (es. SharePoint)</label>
                <input
                  id="nuovoLink"
                  name="nuovoLink"
                  className="input"
                  placeholder="https://..."
                  form="form-comunicazione"
                />
              </div>
              <div className="field">
                <label htmlFor="nuovoLinkEtichetta">Etichetta (opzionale)</label>
                <input
                  id="nuovoLinkEtichetta"
                  name="nuovoLinkEtichetta"
                  className="input"
                  placeholder="Es. Cartella SharePoint"
                  form="form-comunicazione"
                />
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: "1.5rem" }}>
          <button type="submit" form="form-comunicazione" className="btn btn--primary">
            {inModifica ? "Salva modifiche" : "Crea comunicazione"}
          </button>
        </div>
      </div>
      )}

      {/* --- Filtri ed elenco: nascosti mentre si crea/modifica, per non
          mostrare form e lista insieme (vedi inFormMode sopra) --- */}
      {!inFormMode && (
      <>
      {allowed.length > 1 && (
        <div className="tabs">
          <Link href="/admin/comunicazioni" className={`tab${!filtro ? " tab--active" : ""}`}>
            Tutte
          </Link>
          <Link href="/admin/comunicazioni?tipo=ufficiale" className={`tab${filtro === "ufficiale" ? " tab--active" : ""}`}>
            Ufficiali
          </Link>
          <Link href="/admin/comunicazioni?tipo=non_ufficiale" className={`tab${filtro === "non_ufficiale" ? " tab--active" : ""}`}>
            Non ufficiali
          </Link>
          <Link href="/admin/comunicazioni?tipo=rsu" className={`tab${filtro === "rsu" ? " tab--active" : ""}`}>
            RSU
          </Link>
          <Link href="/admin/comunicazioni?tipo=sicurezza" className={`tab${filtro === "sicurezza" ? " tab--active" : ""}`}>
            Sicurezza sul lavoro
          </Link>
          <Link href="/admin/comunicazioni?tipo=eventi" className={`tab${filtro === "eventi" ? " tab--active" : ""}`}>
            Eventi
          </Link>
          <Link href="/admin/comunicazioni?tipo=formazione" className={`tab${filtro === "formazione" ? " tab--active" : ""}`}>
            Notizie Formazione
          </Link>
        </div>
      )}

      {/* --- Elenco --- */}
      {lista.length === 0 ? (
        <div className="card empty">Nessuna comunicazione.</div>
      ) : (
        <ul className="admin-list">
          {lista.map((c) => (
            <li key={c.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {c.titolo}{" "}
                  <span className="badge badge--tipo">{TIPO_LABEL[c.tipo]}</span>{" "}
                  {mostraInEvidenza(c) && <span className="badge badge--highlight">evidenza</span>}
                </div>
                <div className="admin-row__sub">
                  {c.categoria} · {c.autore} · {formatData(c.data)}
                  {c.allegati && c.allegati.length > 0 ? ` · ${c.allegati.length} allegati` : ""}
                  {c.promemoriaData ? ` · Evidenza dal ${formatData(c.promemoriaData)}` : ""}
                  {c.evidenzaFine ? ` · Evidenza fino al ${formatData(c.evidenzaFine)}` : ""}
                  {c.eventoData
                    ? ` · 📅 ${formatData(c.eventoData)}${c.eventoOraInizio ? ` ore ${c.eventoOraInizio}` : ""}`
                    : ""}
                  {c.sondaggioTitolo
                    ? ` · 📊 ${c.sondaggioTitolo}${!c.sondaggioPubblicato ? " (bozza)" : ""}`
                    : ""}
                </div>
              </div>
              {canEditComunicazioneItem(user, c) && (
                <div className="admin-row__actions">
                  <Link href={`/admin/comunicazioni?edit=${c.id}`} className="btn btn--ghost btn--sm">
                    Modifica
                  </Link>
                  <form action={removeComunicazione} className="inline-form">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </section>
  );
}
