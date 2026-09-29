import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getContatti, listSaleGenerali } from "@/lib/data";
import {
  estremiMese,
  getVociCalendarioInPeriodo,
  getProssimeVociCalendario,
} from "@/lib/calendario";
import { formatData, formatOrarioEvento } from "@/lib/format";
import CalendarioApp from "./CalendarioApp";
import { eliminaEvento } from "./actions";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  dati: "Evento non trovato: potrebbe essere già stato eliminato.",
  data: "Data dell'evento non valida.",
  titolo: "Indica di che evento si tratta prima di aggiungerlo.",
  passato: "Non è possibile aggiungere un evento in una data già passata.",
  orario: "L'ora di fine deve essere successiva a quella di inizio.",
  contatto: "Seleziona il tuo nominativo dalla rubrica prima di aggiungere l'evento.",
  sala: "Sala non valida.",
  salabloccata: "Questa sala non è al momento prenotabile: scegline un'altra o indica un altro luogo.",
  occupata:
    "In quell'orario la sala è già occupata: cambia orario o sala. L'evento non è stato creato.",
};

// "Adesso" in ora italiana esplicita (stesso metodo di adessoRoma in
// (site)/page.tsx): il container gira in UTC, quindi senza fuso esplicito il
// giorno corrente sarebbe sbagliato di 1-2h intorno alla mezzanotte — qui il
// valore decide anche quali giorni sono "passati" e quindi non più compilabili.
function adessoRoma(): { data: string; ora: string } {
  const now = new Date();
  return {
    data: now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }),
    ora: new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now),
  };
}

// Calendario degli eventi in programma: una sezione a sé in cui chiunque può
// aggiungere un evento cliccando il giorno (senza login, nominativo dalla
// rubrica), e in cui confluiscono anche gli eventi fissati nelle comunicazioni
// (campi evento_* del back office) — vedi lib/calendario.ts per l'unione delle
// due sorgenti.
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; eliminato?: string; giorno?: string }>;
}) {
  const { ok, error, eliminato, giorno } = await searchParams;
  const { data: oggiIso, ora: oraAdesso } = adessoRoma();

  // Il mese aperto è quello del giorno passato in querystring (rimando dopo un
  // inserimento/eliminazione), altrimenti il mese corrente.
  const giornoIniziale = giorno && /^\d{4}-\d{2}-\d{2}$/.test(giorno) ? giorno : null;
  const base = giornoIniziale ?? oggiIso;
  const anno = Number(base.slice(0, 4));
  const mese = Number(base.slice(5, 7));
  const { inizio, fine } = estremiMese(anno, mese);

  const [voci, contatti, sale, prossime] = await Promise.all([
    getVociCalendarioInPeriodo(inizio, fine),
    getContatti(),
    listSaleGenerali(),
    getProssimeVociCalendario(oggiIso, oraAdesso, 8),
  ]);

  return (
    <section>
      <header className="page-header">
        <h1>{ROUTES.calendario.label}</h1>
        <p>{ROUTES.calendario.description}</p>
      </header>

      {ok && <div className="notice notice--ok">Evento aggiunto al calendario.</div>}
      {eliminato && <div className="notice notice--ok">Evento eliminato.</div>}
      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      <CalendarioApp
        anno={anno}
        mese={mese}
        vociIniziali={voci}
        contatti={contatti}
        sale={sale}
        oggiIso={oggiIso}
        giornoIniziale={giornoIniziale}
      />

      <h2 style={{ fontSize: "1.05rem", margin: "2rem 0 0.9rem" }}>Prossimi eventi</h2>
      {prossime.length === 0 ? (
        <div className="card empty">Nessun evento in programma.</div>
      ) : (
        <ul className="admin-list">
          {prossime.map((v) => (
            <li key={`${v.origine}-${v.id}`} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {formatData(v.data)} · {formatOrarioEvento(v.oraInizio, v.oraFine)} ·{" "}
                  {v.href ? <Link href={v.href}>{v.titolo}</Link> : v.titolo}
                </div>
                {v.luogo && (
                  <div className="admin-row__sub">
                    📍 {v.luogo}
                    {v.salaPrenotata && " · sala prenotata"}
                  </div>
                )}
                <div className="admin-row__sub">
                  {v.origine === "comunicazione"
                    ? `Dalla comunicazione di ${v.autore}`
                    : `Inserito da ${v.autore}`}
                </div>
              </div>
              {v.origine === "calendario" ? (
                <form action={eliminaEvento} className="inline-form">
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
                </form>
              ) : (
                <span className="chip">Comunicazione</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
