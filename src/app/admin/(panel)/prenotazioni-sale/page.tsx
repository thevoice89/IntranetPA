import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSale, listPrenotazioniSala, getImpostazioni } from "@/lib/data";
import { saveSalaNotifica, removePrenotazioneSala, salvaEmailAssistenza } from "@/app/admin/actions";
import { oggiIso as oggiIsoRoma } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatDataItaliana(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// creato_il arriva già come "YYYY-MM-DDTHH:MM" (to_char lato query, vedi
// PRENOTAZIONE_SALA_COLS in lib/data.ts): timeZone esplicito per lo stesso motivo
// di formatDataOra in admin/segnalazioni/page.tsx, il container gira in UTC.
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

export default async function AdminPrenotazioniSale() {
  await requireAdmin();
  const [sale, prenotazioni, impostazioni] = await Promise.all([
    listSale(),
    listPrenotazioniSala(),
    getImpostazioni(),
  ]);

  const oggiIso = oggiIsoRoma();

  return (
    <section>
      <header className="page-header">
        <h1>Prenotazione sale</h1>
        <p>{prenotazioni.length} prenotazioni · configurazione notifiche e gestione</p>
      </header>

      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Sale</h2>
      <p className="help" style={{ marginBottom: "1rem" }}>
        Per ogni sala puoi disattivarla del tutto ("Sala non prenotabile": sparisce dalla
        scelta pubblica finché non la riattivi), bloccare singoli orari nel suo calendario, e
        configurare a chi inoltrare via email ogni nuova prenotazione.
      </p>
      <ul className="admin-list" style={{ marginBottom: "2rem" }}>
        {sale.map((s) => (
          <li key={s.id} className="card" style={{ padding: "1.2rem" }}>
            <form action={saveSalaNotifica} className="form">
              <input type="hidden" name="id" value={s.id} />
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.7rem" }}>{s.nome}</h3>

              <div className="field field--check">
                <input
                  id={`bloccata-${s.id}`}
                  name="bloccata"
                  type="checkbox"
                  defaultChecked={s.bloccata}
                />
                <label htmlFor={`bloccata-${s.id}`} style={{ color: "var(--text)" }}>
                  Sala non prenotabile
                </label>
              </div>

              <p style={{ marginBottom: "0.9rem" }}>
                <Link href={`/admin/prenotazioni-sale/${s.id}`} className="help">
                  Blocca singoli orari nel calendario di questa sala →
                </Link>
              </p>

              <div className="field">
                <label htmlFor={`email-${s.id}`}>Email destinatario</label>
                <input
                  id={`email-${s.id}`}
                  name="emailNotifica"
                  type="email"
                  multiple
                  className="input"
                  defaultValue={s.emailNotifica}
                  placeholder="es. segreteria@comune.esempio.it, altro@comune.esempio.it"
                />
                <p className="help">Per più destinatari, separa gli indirizzi con una virgola.</p>
              </div>
              <div className="field">
                <label htmlFor={`msg-${s.id}`}>Messaggio</label>
                <textarea
                  id={`msg-${s.id}`}
                  name="messaggioNotifica"
                  className="textarea"
                  rows={2}
                  defaultValue={s.messaggioNotifica}
                  placeholder="Testo che precede i dettagli della prenotazione nell'email…"
                />
                <p className="help">
                  Puoi usare <code>{"{{nome}}"}</code>, <code>{"{{motivazione}}"}</code> e{" "}
                  <code>{"{{data}}"}</code>: verranno sostituiti con il nominativo, le note e la
                  data di ogni prenotazione.
                </p>
              </div>
              <button type="submit" className="btn btn--primary btn--sm">Salva</button>
            </form>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Notifica assistenza</h2>
      <p className="help" style={{ marginBottom: "1rem" }}>
        Se chi prenota spunta &quot;Mi serve assistenza Tecnica&quot; o &quot;Mi serve assistenza
        Informatica&quot;, viene inviata un&apos;email separata (non legata a una sala specifica)
        al destinatario indicato qui sotto. Lascia vuoto per non inviare nulla.
      </p>
      <div className="card" style={{ padding: "1.2rem", marginBottom: "2rem" }}>
        <form action={salvaEmailAssistenza} className="form">
          <div className="field">
            <label htmlFor="emailAssistenzaTecnica">Email assistenza Tecnica</label>
            <input
              id="emailAssistenzaTecnica"
              name="emailAssistenzaTecnica"
              type="email"
              multiple
              className="input"
              defaultValue={impostazioni["email_assistenza_tecnica"] ?? ""}
              placeholder="es. manutenzione@comune.esempio.it"
            />
          </div>
          <div className="field">
            <label htmlFor="emailAssistenzaInformatica">Email assistenza Informatica</label>
            <input
              id="emailAssistenzaInformatica"
              name="emailAssistenzaInformatica"
              type="email"
              multiple
              className="input"
              defaultValue={impostazioni["email_assistenza_informatica"] ?? ""}
              placeholder="es. cedsistemi@comune.esempio.it"
            />
          </div>
          <p className="help">Per più destinatari, separa gli indirizzi con una virgola.</p>
          <button type="submit" className="btn btn--primary btn--sm">Salva</button>
        </form>
      </div>

      <h2 style={{ fontSize: "1.05rem", marginBottom: "0.9rem" }}>Prenotazioni</h2>
      {prenotazioni.length === 0 ? (
        <div className="card empty">Nessuna prenotazione ricevuta.</div>
      ) : (
        <ul className="admin-list">
          {prenotazioni.map((p) => {
            const passata = p.data < oggiIso;
            return (
              <li key={p.id} className="card admin-row" style={passata ? { opacity: 0.6 } : undefined}>
                <div className="admin-row__main">
                  <div className="admin-row__title">
                    {p.salaNome} · {formatDataItaliana(p.data)} · dalle {p.oraInizio} alle {p.oraFine}
                  </div>
                  <div className="admin-row__sub">
                    {p.richiedente}
                    {p.richiedenteEmail && ` · ${p.richiedenteEmail}`}
                    {" · prenotata il "}
                    {formatDataOra(p.creatoIl)}
                  </div>
                  {p.note && <div className="admin-row__sub">{p.note}</div>}
                  {p.assistenzaTecnica && (
                    <div className="admin-row__sub">
                      Assistenza tecnica richiesta
                      {p.assistenzaTecnicaDettaglio && `: ${p.assistenzaTecnicaDettaglio}`}
                    </div>
                  )}
                  {p.assistenzaInformatica && (
                    <div className="admin-row__sub">
                      Assistenza informatica richiesta
                      {p.assistenzaInformaticaDettaglio && `: ${p.assistenzaInformaticaDettaglio}`}
                    </div>
                  )}
                </div>
                <form action={removePrenotazioneSala} className="inline-form">
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
