import { requireAdmin } from "@/lib/auth";
import { listLogAttivita } from "@/lib/data";

export const dynamic = "force-dynamic";

const AREA_LABEL: Record<string, string> = {
  prenotazione_sala: "Prenotazione sale",
  segnalazione: "Segnalazioni",
  comunicazione: "Comunicazioni",
  commento: "Commenti",
  modulo: "Moduli",
  sondaggio: "Sondaggi",
  presenza: "Presenze",
};

// Stesso trattamento di formatDataOra in admin/prenotazioni-sale/page.tsx: quando
// arriva già come "YYYY-MM-DDTHH:MM:SS" (to_char lato query), timeZone esplicito
// perché il container gira in UTC.
function formatDataOra(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Rome",
  });
}

// Sola lettura, solo admin: traccia le azioni pubbliche senza login (chiunque può
// creare/eliminare prenotazioni sale, inviare segnalazioni/commenti/comunicazioni
// non ufficiali, compilare moduli/sondaggi, impostare presenze altrui) — vedi
// lib/log-attivita.ts. Retention di 30 giorni applicata a ogni scrittura in
// data.registraAttivita, nessuna azione manuale di pulizia qui.
export default async function AdminLogAttivita() {
  await requireAdmin();
  const log = await listLogAttivita();

  return (
    <section>
      <header className="page-header">
        <h1>Log attività</h1>
        <p>
          {log.length} eventi negli ultimi 30 giorni · azioni pubbliche senza login
          (prenotazione sale, segnalazioni, commenti, comunicazioni non ufficiali,
          moduli, sondaggi, presenze). Le voci più vecchie di 30 giorni vengono
          eliminate automaticamente.
        </p>
      </header>

      {log.length === 0 ? (
        <div className="card empty">Nessuna attività registrata.</div>
      ) : (
        <ul className="admin-list">
          {log.map((l) => (
            <li key={l.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">{l.descrizione}</div>
                <div className="admin-row__sub">
                  {AREA_LABEL[l.area] ?? l.area} · {l.azione} · {formatDataOra(l.quando)}
                  {l.ip && ` · ${l.ip}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
