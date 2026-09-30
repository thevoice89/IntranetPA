import { requireAdmin } from "@/lib/auth";
import { getOrdineMenu, getImpostazioni } from "@/lib/data";
import { ordinaConFallback } from "@/lib/ordina-menu";
import { applicaEtichette } from "@/lib/etichette-menu";
import { SEZIONI_HOME_DEFAULT } from "@/lib/home-sezioni";
import { resolveSmtpConfig } from "@/lib/mail";
import { salvaImpostazioniGenerali, salvaImpostazioniMeteo } from "@/app/admin/actions";
import { CHIAVI_BRANDING, DEFAULT_BRANDING, IMMAGINI_ENTE, brandingDa } from "@/lib/branding";
import MenuSortableList from "../menu/MenuSortableList";
import SmtpForm from "./SmtpForm";
import ImmagineEnteForm from "./ImmagineEnteForm";

export const dynamic = "force-dynamic";

const ERRORI: Record<string, string> = {
  emailAccoglienza: "L'email dell'accoglienza non è valida.",
  meteoCoppia: "Inserisci sia la latitudine sia la longitudine, oppure lasciale vuote entrambe.",
  meteoLatitudine: "La latitudine deve essere un numero tra -90 e 90 (es. 45.6134).",
  meteoLongitudine: "La longitudine deve essere un numero tra -180 e 180 (es. 9.5085).",
  meteoUrl: "Il link del meteo deve iniziare con http:// o https://.",
};

// Impostazioni generali del sito (solo admin): nome dell'ente, titolo/sottotitolo
// mostrati in home, stemma e logo, luogo nei PDF, email dell'accoglienza, meteo,
// ordine e nomi delle sezioni della homepage, configurazione SMTP per le email in
// uscita (notifiche moduli, risposte alle segnalazioni). Il riordino delle voci di
// menu vero e proprio resta in /admin/menu. I valori vuoti ricadono sui default di
// lib/branding.ts, quindi un'installazione nuova funziona senza aver configurato nulla.
export default async function AdminImpostazioni({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; salvato?: string }>;
}) {
  await requireAdmin();
  const { error, salvato } = await searchParams;
  const [ordineHome, impostazioni, smtp] = await Promise.all([
    getOrdineMenu("home"),
    getImpostazioni(),
    resolveSmtpConfig(),
  ]);

  const branding = brandingDa(impostazioni);

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
        <p>Personalizza ente, stemma e logo, sezioni della home ed email in uscita.</p>
      </header>

      {error && <div className="alert">{ERRORI[error] ?? "Controlla i dati inseriti e riprova."}</div>}
      {salvato && <div className="notice notice--ok">Impostazioni salvate.</div>}

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Ente e Intranet</h2>
        <form action={salvaImpostazioniGenerali} className="form">
          <div className="field">
            <label htmlFor="enteNome">Nome dell&apos;ente</label>
            <input
              id="enteNome"
              name="enteNome"
              className="input"
              placeholder={DEFAULT_BRANDING.nome}
              defaultValue={impostazioni[CHIAVI_BRANDING.nome] ?? ""}
            />
            <p className="help">
              Compare nel titolo della scheda del browser e, se non scrivi un sottotitolo,
              sotto il titolo della home.
            </p>
          </div>
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
              placeholder={branding.nome}
              defaultValue={impostazioni["sito_sottotitolo"] ?? ""}
            />
          </div>
          <div className="field--row">
            <div className="field">
              <label htmlFor="enteLuogo">Luogo nei PDF</label>
              <input
                id="enteLuogo"
                name="enteLuogo"
                className="input"
                placeholder={DEFAULT_BRANDING.luogo}
                defaultValue={impostazioni[CHIAVI_BRANDING.luogo] ?? ""}
              />
              <p className="help">Prima della data nei moduli PDF: «{branding.luogo}, 1 gennaio 2026».</p>
            </div>
            <div className="field">
              <label htmlFor="emailAccoglienza">Email dell&apos;accoglienza</label>
              <input
                id="emailAccoglienza"
                name="emailAccoglienza"
                type="email"
                className="input"
                placeholder="accoglienza@ente.it"
                defaultValue={impostazioni[CHIAVI_BRANDING.emailAccoglienza] ?? ""}
              />
              <p className="help">
                Riceve l&apos;avviso quando qualcuno dichiara suo un pacco («Di chi è?»).
                Vuoto: nessun avviso.
              </p>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn--primary">
              Salva
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Stemma e logo</h2>
        <div className="form">
          <ImmagineEnteForm
            tipo="stemma"
            etichetta={IMMAGINI_ENTE.stemma.etichetta}
            descrizione="Mostrato in alto nella barra laterale del sito e del pannello. Meglio se verticale o quadrato, con sfondo trasparente."
            urlAttuale={branding.stemmaUrl}
            personalizzata={branding.stemmaPersonalizzato}
            maxLato={IMMAGINI_ENTE.stemma.maxLato}
          />
          <ImmagineEnteForm
            tipo="logo"
            etichetta={IMMAGINI_ENTE.logo.etichetta}
            descrizione="Intestazione dei PDF generati (moduli compilati). Meglio se orizzontale, circa il doppio più largo che alto."
            urlAttuale={branding.logoUrl}
            personalizzata={branding.logoPersonalizzato}
            maxLato={IMMAGINI_ENTE.logo.maxLato}
          />
          <p className="help">
            Puoi scegliere PNG, JPEG, WebP, GIF o SVG: viene ridimensionato e convertito in PNG
            in automatico (massimo 2 MB dopo la conversione).
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Meteo in home</h2>
        <form action={salvaImpostazioniMeteo} className="form">
          <div className="field--row">
            <div className="field">
              <label htmlFor="meteoLatitudine">Latitudine</label>
              <input
                id="meteoLatitudine"
                name="meteoLatitudine"
                className="input"
                inputMode="decimal"
                placeholder={String(DEFAULT_BRANDING.meteoLatitudine)}
                defaultValue={impostazioni[CHIAVI_BRANDING.meteoLatitudine] ?? ""}
              />
            </div>
            <div className="field">
              <label htmlFor="meteoLongitudine">Longitudine</label>
              <input
                id="meteoLongitudine"
                name="meteoLongitudine"
                className="input"
                inputMode="decimal"
                placeholder={String(DEFAULT_BRANDING.meteoLongitudine)}
                defaultValue={impostazioni[CHIAVI_BRANDING.meteoLongitudine] ?? ""}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="meteoUrl">Link al click sul meteo</label>
            <input
              id="meteoUrl"
              name="meteoUrl"
              type="url"
              className="input"
              placeholder={DEFAULT_BRANDING.meteoUrl}
              defaultValue={impostazioni[CHIAVI_BRANDING.meteoUrl] ?? ""}
            />
            <p className="help">
              Le coordinate del tuo comune si leggono da una mappa (clic destro su Google Maps).
              Se lasci i campi vuoti si usa l&apos;esempio (Roma).
            </p>
          </div>
          <div>
            <button type="submit" className="btn btn--primary">
              Salva meteo
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
