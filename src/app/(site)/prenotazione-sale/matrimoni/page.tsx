import Link from "next/link";
import { getContatti, getPrenotazioniSalaFuture, listSaleMatrimoni } from "@/lib/data";
import PrenotazioneSaleApp from "../PrenotazioneSaleApp";
import { eliminaPrenotazione } from "../actions";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  dati: "Seleziona almeno una fascia oraria prima di confermare.",
  sala: "Sala non valida.",
  contatto: "Indica il nominativo di chi prenota prima di confermare.",
  oggetto: "Inserisci l'oggetto della riunione prima di confermare.",
  passato: "Non è possibile prenotare per una data già passata.",
  conflitto: "Nel frattempo la sala è già stata prenotata in tutte le ore scelte: riprova con altri orari.",
  salabloccata: "Questa sala non è al momento prenotabile.",
};

// Le uniche due sale prenotabili da questa sezione (vedi listSaleMatrimoni in
// lib/data.ts): usato anche per limitare l'elenco "Prossime prenotazioni" qui
// sotto alle sole prenotazioni rilevanti per un matrimonio.
const NOMI_SALE_MATRIMONI = ["Sala degli Specchi", "Sala Bernabò"];

function formatDataItaliana(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function PrenotazioneSaleMatrimoniPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; conflitti?: string; eliminata?: string }>;
}) {
  const { ok, error, conflitti, eliminata } = await searchParams;
  const [sale, contatti, prenotazioniFuture] = await Promise.all([
    listSaleMatrimoni(),
    getContatti(),
    getPrenotazioniSalaFuture(30, NOMI_SALE_MATRIMONI),
  ]);

  // Fuso esplicito (stesso metodo di adessoRoma in (site)/page.tsx): il container
  // gira in UTC, quindi new Date().getDate() sarebbe sbagliato di 1-2h intorno alla
  // mezzanotte italiana — qui il valore serve anche a bloccare le date passate nel
  // calendario, non solo a scegliere la settimana iniziale, quindi va corretto.
  const oggiIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

  return (
    <section>
      <header className="page-header">
        <h1>Matrimoni</h1>
        <p>Prenota la Sala degli Specchi o la Sala Bernabò per un matrimonio</p>
      </header>

      {ok && !conflitti && <div className="notice notice--ok">Prenotazione confermata.</div>}
      {ok && conflitti && (
        <div className="notice notice--ok">
          Prenotazione confermata, tranne {conflitti} fascia/e oraria/e nel frattempo già
          prenotata/e da altri: controlla il calendario e riprova per quella/e.
        </div>
      )}
      {eliminata && <div className="notice notice--ok">Prenotazione eliminata.</div>}
      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}

      <p style={{ marginBottom: "1.2rem" }}>
        <Link href="/prenotazione-sale">← Torna a Prenotazione sale</Link>
      </p>

      <PrenotazioneSaleApp
        sale={sale}
        contatti={contatti}
        oggiIso={oggiIso}
        origine="/prenotazione-sale/matrimoni"
      />

      <h2 style={{ fontSize: "1.05rem", margin: "2rem 0 0.9rem" }}>Prossime prenotazioni</h2>
      {prenotazioniFuture.length === 0 ? (
        <div className="card empty">Nessuna prenotazione futura.</div>
      ) : (
        <ul className="admin-list">
          {prenotazioniFuture.map((p) => (
            <li key={p.id} className="card admin-row">
              <div className="admin-row__main">
                <div className="admin-row__title">
                  {p.salaNome} · {formatDataItaliana(p.data)} · dalle {p.oraInizio} alle {p.oraFine}
                </div>
                <div className="admin-row__sub">{p.richiedente}</div>
                {p.note && <div className="admin-row__sub">{p.note}</div>}
              </div>
              <form action={eliminaPrenotazione} className="inline-form">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="origine" value="/prenotazione-sale/matrimoni" />
                <button type="submit" className="btn btn--danger btn--sm">Elimina</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
