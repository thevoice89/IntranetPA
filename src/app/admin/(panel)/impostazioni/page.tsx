import { requireAdmin } from "@/lib/auth";
import { getOrdineMenu, getImpostazioni } from "@/lib/data";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { SEZIONI_HOME_DEFAULT } from "@/lib/home-sezioni";
import { resolveSmtpConfig } from "@/lib/mail";
import { salvaImpostazioniGenerali } from "@/app/admin/actions";
import MenuSortableList from "../menu/MenuSortableList";
import SmtpForm from "./SmtpForm";

export const dynamic = "force-dynamic";

// Impostazioni generali del sito (solo admin): titolo/sottotitolo mostrati in home,
// ordine e nomi delle sezioni della homepage, configurazione SMTP per le email in
// uscita (notifiche moduli, risposte alle segnalazioni). Il riordino delle voci di
// menu vero e proprio resta in /admin/menu.
export default async function AdminImpostazioni() {
  await requireAdmin();
  const [ordineHome, impostazioni, smtp] = await Promise.all([
    getOrdineMenu("home"),
    getImpostazioni(),
    resolveSmtpConfig(),
  ]);

  const sezioniHome = applicaEtichette(
    ordinaConFallback(SEZIONI_HOME_DEFAULT, (s) => s.chiave, ordineHome),
    (s) => s.chiave,
    "home",
    impostazioni
  );

  return (
    <section>
      <header className="page-header">
        <h1>Impostazioni</h1>
        <p>Personalizza titolo, sezioni della home ed email in uscita.</p>
      </header>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Intranet</h2>
        <form action={salvaImpostazioniGenerali} className="form">
          <div className="field">
            <label htmlFor="sitoTitolo">Titolo (mostrato in home)</label>
            <input
              id="sitoTitolo"
              name="sitoTitolo"
              className="input"
              placeholder="Benvenuto nell'Intranet"
              defaultValue={impostazioni["sito_titolo"] ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="sitoSottotitolo">Sottotitolo</label>
            <input
              id="sitoSottotitolo"
              name="sitoSottotitolo"
              className="input"
              placeholder="Comune di Esempio"
              defaultValue={impostazioni["sito_sottotitolo"] ?? ""}
            />
          </div>
          <div>
            <button type="submit" className="btn btn--primary">
              Salva
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Sezioni della home</h2>
        <p className="help" style={{ marginBottom: "0.9rem" }}>
          Trascina per cambiare l&apos;ordine con cui compaiono in home, clicca sul nome
          per rinominarle.
        </p>
        <MenuSortableList menu="home" voci={sezioniHome} />
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Email in uscita (SMTP)</h2>
        <SmtpForm
          valori={{
            // host/porta/sicura/utente/mittente: valori davvero in vigore ora (DB
            // se presente, altrimenti le variabili d'ambiente SMTP_* del server) —
            // così la checkbox "sicura" riflette lo stato reale invece di ripartire
            // da un default scollegato. La password invece arriva SOLO dal DB (mai
            // dall'env): un eventuale segreto impostato lato server non va esposto
            // in un campo del form, solo quello salvato qui da pannello.
            host: smtp.host,
            port: String(smtp.port),
            secure: smtp.secure,
            user: smtp.user,
            password: impostazioni["smtp_password"] ?? "",
            from: smtp.from,
          }}
        />
      </div>
    </section>
  );
}
