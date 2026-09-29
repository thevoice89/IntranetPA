import Link from "next/link";
import { notFound } from "next/navigation";
import { getComunicazione, incrementaVisualizzazioni, listCommenti, getContatti } from "@/lib/data";
import { getCurrentUser, canEditComunicazioneItem } from "@/lib/auth";
import { formatData, mostraInEvidenza } from "@/lib/format";
import { corpoComunicazioneHtml } from "@/lib/rich-text";
import { ROUTES } from "@/lib/routes";
import { Allegati } from "@/components/ui/Allegati";
import { EditButton } from "@/components/ui/EditButton";
import { inviaCommento } from "@/app/(site)/comunicazioni/actions";
import ContattoField from "@/components/ui/ContattoField";

export const dynamic = "force-dynamic";

const ERRORI_COMMENTO: Record<string, string> = {
  testo: "Scrivi un commento prima di inviare.",
  contatto: "Seleziona il tuo nominativo dalla rubrica prima di inviare.",
};

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

export default async function ComunicazioneDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    commentoOk?: string;
    commentoError?: string;
    pubblicato?: string;
  }>;
}) {
  const { id } = await params;
  const { commentoOk, commentoError, pubblicato } = await searchParams;
  const c = await getComunicazione(id);
  if (!c) notFound();
  // Incrementata ad ogni apertura di questa pagina: c.visualizzazioni riflette
  // ancora il conteggio prima di questa apertura, per questo si mostra +1 sotto.
  await incrementaVisualizzazioni(id);
  const user = await getCurrentUser();
  const commenti = c.commentiAbilitati ? await listCommenti(id) : [];
  const contatti = c.commentiAbilitati ? await getContatti() : [];

  const backHref =
    c.tipo === "ufficiale"
      ? "/comunicazioni-ufficiali"
      : c.tipo === "rsu"
        ? "/comunicazioni-rsu"
        : c.tipo === "sicurezza"
          ? "/comunicazioni-sicurezza"
          : c.tipo === "eventi"
            ? "/comunicazioni-eventi"
            : c.tipo === "formazione"
              ? "/comunicazioni-formazione"
              : "/comunicazioni-non-ufficiali";
  const backLabel =
    c.tipo === "ufficiale"
      ? "Comunicazioni Ufficiali"
      : c.tipo === "rsu"
        ? "Comunicazioni RSU"
        : c.tipo === "sicurezza"
          ? "Sicurezza sul lavoro"
          : c.tipo === "eventi"
            ? "Eventi"
            : c.tipo === "formazione"
              ? "Notizie Formazione"
              : "Comunicazioni Non Ufficiali";

  return (
    <section>
      <header className="page-header">
        <Link href={backHref} className="help">← {backLabel}</Link>
        <div className="page-header__row" style={{ marginTop: "0.6rem" }}>
          <div className="comm-item__top">
            {c.tipo === "ufficiale" && <span className="badge">{c.categoria}</span>}
            {c.tipo === "rsu" && <span className="badge badge--rsu">RSU</span>}
            {c.tipo === "sicurezza" && <span className="badge badge--sicurezza">Sicurezza</span>}
            {c.tipo === "eventi" && <span className="badge badge--eventi">Eventi</span>}
            {c.tipo === "formazione" && <span className="badge badge--formazione">Notizie Formazione</span>}
            {mostraInEvidenza(c) && <span className="badge badge--highlight">In evidenza</span>}
          </div>
          {user && canEditComunicazioneItem(user, c) && (
            <EditButton href={`/admin/comunicazioni?edit=${c.id}`} />
          )}
        </div>
        <h1>{c.titolo}</h1>
        <div className="comm-item__meta">
          <strong>{c.autore}</strong>
          <span>·</span>
          <time dateTime={c.data}>{formatData(c.data)}</time>
        </div>
      </header>

      {pubblicato && (
        <div className="notice notice--ok" style={{ marginBottom: "1.1rem" }}>
          Comunicazione pubblicata! È visibile a tutti nella bacheca.
        </div>
      )}

      <article className="card" style={{ padding: "1.5rem" }}>
        {c.estratto && (
          <p style={{ fontWeight: 500, color: "var(--muted)", marginBottom: "1rem" }}>
            {c.estratto}
          </p>
        )}
        {/* Il corpo è HTML prodotto dall'editor ricco del pannello. I testi
            più vecchi (e quelli inviati dal form pubblico della bacheca, che
            resta una textarea) sono testo semplice: corpoComunicazioneHtml li
            converte in paragrafi e in ogni caso sanifica prima di stampare. */}
        <div
          className="rich-text"
          dangerouslySetInnerHTML={{ __html: corpoComunicazioneHtml(c.corpo) }}
        />
        <Allegati allegati={c.allegati} />
        <p className="help" style={{ textAlign: "right", marginTop: "1rem", marginBottom: 0 }}>
          Visualizzato {c.visualizzazioni + 1} volte
        </p>
      </article>

      {/* Evento collegato: da qui non si scarica più nulla (l'invito .ics
          "Aggiungi al mio calendario" è stato rimosso). La data resta mostrata e
          la comunicazione confluisce nel Calendario dell'Intranet, dove la si
          ritrova insieme agli altri eventi — vedi lib/calendario.ts. */}
      {c.eventoData && (
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "0.6rem" }}>
            📅 Quando
          </h2>
          <p style={{ marginBottom: "0.35rem" }}>
            <strong>{formatData(c.eventoData)}</strong>
            {c.eventoOraInizio && (
              <>
                {" · ore "}
                {c.eventoOraInizio}
                {c.eventoOraFine ? `–${c.eventoOraFine}` : ""}
              </>
            )}
          </p>
          {c.eventoLuogo && (
            <p className="help" style={{ marginBottom: "1rem" }}>{c.eventoLuogo}</p>
          )}
          <Link
            href={`${ROUTES.calendario.path}?giorno=${c.eventoData}`}
            className="btn btn--ghost btn--sm"
            style={{ marginTop: c.eventoLuogo ? 0 : "0.75rem" }}
          >
            Vedi nel calendario →
          </Link>
        </div>
      )}

      {c.sondaggioId && c.sondaggioPubblicato && (
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "0.6rem" }}>
            📊 Sondaggio collegato
          </h2>
          <p style={{ marginBottom: "1rem" }}>{c.sondaggioTitolo}</p>
          <Link href={`/sondaggi/${c.sondaggioId}`} className="btn btn--primary">
            Partecipa al sondaggio →
          </Link>
        </div>
      )}

      {c.proceduraId && c.proceduraPubblicato && (
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "0.6rem" }}>
            📋 Procedura collegata
          </h2>
          <p style={{ marginBottom: "1rem" }}>{c.proceduraTitolo}</p>
          <Link href={`/procedure/${c.proceduraId}`} className="btn btn--primary">
            Vedi la procedura →
          </Link>
        </div>
      )}

      {c.moduloId && c.moduloPubblicato && (
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "0.6rem" }}>
            📝 Modulo collegato
          </h2>
          <p style={{ marginBottom: "1rem" }}>{c.moduloTitolo}</p>
          <Link href={`/moduli/${c.moduloId}`} className="btn btn--primary">
            Vai al modulo →
          </Link>
        </div>
      )}

      {c.guidaId && (
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "0.6rem" }}>
            📚 Formazione dei colleghi collegata
          </h2>
          <p style={{ marginBottom: "1rem" }}>{c.guidaTitolo}</p>
          <Link href={`/formazione/colleghi-per-colleghi/${c.guidaId}`} className="btn btn--primary">
            Vedi il contributo →
          </Link>
        </div>
      )}

      {c.commentiAbilitati && (
        <div className="card commenti" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h2 className="section-title" style={{ margin: 0, marginBottom: "1.1rem" }}>
            Commenti{commenti.length > 0 ? ` (${commenti.length})` : ""}
          </h2>

          {commentoOk && (
            <div className="notice notice--ok">Grazie! Il tuo commento è stato pubblicato.</div>
          )}
          {commentoError && (
            <div className="alert">{ERRORI_COMMENTO[commentoError] ?? "Controlla i dati inseriti e riprova."}</div>
          )}

          {commenti.length > 0 ? (
            <ul className="commenti-list">
              {commenti.map((cm) => (
                <li key={cm.id} className="commento-item">
                  <div className="commento-item__meta">
                    <strong>{cm.autore}</strong>
                    <span>·</span>
                    <span>{formatDataOra(cm.creatoIl)}</span>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", marginTop: "0.3rem" }}>{cm.testo}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="help" style={{ marginBottom: "1rem" }}>
              Nessun commento ancora: scrivi il primo.
            </p>
          )}

          <form action={inviaCommento} className="form" style={{ marginTop: "1.25rem" }}>
            <input type="hidden" name="comunicazioneId" value={c.id} />
            <ContattoField
              contatti={contatti}
              storageKey="commento-contatto"
              label="Il tuo nominativo"
              help="Scegli il tuo nominativo dalla rubrica: serve per firmare il commento."
            />
            <div className="field">
              <label htmlFor="testo">Commento</label>
              <textarea id="testo" name="testo" className="textarea" rows={3} required />
            </div>
            <div>
              <button type="submit" className="btn btn--primary">Pubblica commento</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
