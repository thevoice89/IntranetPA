// Invio email via SMTP generico (Office 365, PEC, Aruba, ecc. — qualunque provider
// che esponga SMTP AUTH). Configurazione risolta da /admin/impostazioni (tabella
// impostazioni, vedi lib/data.ts) con fallback alle variabili d'ambiente SMTP_* per
// chi non l'ha ancora impostata da pannello. Se non c'è configurazione da nessuna
// delle due parti, le funzioni non fanno nulla: l'infrastruttura resta pronta ma
// silenziosa finché nessuno valorizza host/utente.
import nodemailer from "nodemailer";
import { getImpostazioni } from "@/lib/data";
import { brandingDa } from "@/lib/branding";
import type { Modulo, Segnalazione, Sala, PrenotazioneSala, Pacco } from "@/types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

// Nessuna cache del transporter: le credenziali possono cambiare da pannello in
// qualunque momento (a differenza della vecchia versione solo-env, immutabile per
// tutta la vita del processo), quindi ogni invio risolve la configurazione corrente.
// Esportata (non solo uso interno) perché /admin/impostazioni la usa per precompilare
// il form con i valori davvero in vigore ora, DB o env che siano — così la checkbox
// "sicura" non riparte da un default scollegato dalla configurazione realmente attiva
// (vedi SmtpForm.tsx: la password invece non passa da qui, per non esporre in UI un
// eventuale segreto impostato solo lato server via env).
export async function resolveSmtpConfig(): Promise<SmtpConfig> {
  const imp = await getImpostazioni();
  const host = imp["smtp_host"] || process.env.SMTP_HOST || "";
  const port = Number(imp["smtp_port"] || process.env.SMTP_PORT) || 587;
  const secureRaw = imp["smtp_secure"] || process.env.SMTP_SECURE;
  const secure = secureRaw ? secureRaw === "true" : port === 465;
  const user = imp["smtp_user"] || process.env.SMTP_USER || "";
  const password = imp["smtp_password"] || process.env.SMTP_PASSWORD || "";
  const from = imp["smtp_from"] || process.env.SMTP_FROM || user;
  return { host, port, secure, user, password, from };
}

function smtpConfigurato(cfg: SmtpConfig): boolean {
  return Boolean(cfg.host);
}

function buildTransporter(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Notifica il referente di un modulo che è arrivata una nuova compilazione.
// Non lancia mai in caso di SMTP non configurato o destinatario assente: è il
// chiamante (l'azione pubblica di invio modulo) a decidere se e come loggare
// un eventuale errore di invio reale, senza mai far fallire la compilazione.
export async function inviaNotificaModulo(modulo: Modulo): Promise<void> {
  if (!modulo.emailNotifica) return;
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    console.warn(
      `[mail] SMTP non configurato: notifica per il modulo "${modulo.titolo}" non inviata.`
    );
    return;
  }

  const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const link = `${baseUrl}/admin/moduli-ricevuti?modulo=${modulo.id}`;

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: modulo.emailNotifica,
    subject: `Nuova compilazione: ${modulo.titolo}`,
    text: `È stata ricevuta una nuova compilazione per il modulo "${modulo.titolo}" (${modulo.ufficioNome}).\n\nVai al pannello per i dettagli: ${link}`,
    html: `<p>È stata ricevuta una nuova compilazione per il modulo <strong>${escapeHtml(modulo.titolo)}</strong> (${escapeHtml(modulo.ufficioNome)}).</p><p><a href="${link}">Vai al pannello per i dettagli</a></p>`,
  });
}

// Invia la risposta admin a una segnalazione, all'indirizzo (snapshot) del contatto
// rubrica che l'ha inviata. A differenza di inviaNotificaModulo — che è un no-op
// silenzioso pensato per una notifica interna "best effort" — questa LANCIA se SMTP
// non è configurato o l'invio fallisce: qui l'admin ha scritto una risposta
// aspettandosi che parta, quindi il chiamante (rispondiSegnalazione in
// app/admin/actions.ts) deve poter mostrare l'errore in UI invece di perderlo in un log.
export async function inviaRispostaSegnalazione(
  segnalazione: Segnalazione,
  rispostaTesto: string
): Promise<void> {
  if (!segnalazione.autoreEmail) return; // rete di sicurezza: il chiamante verifica già prima
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    throw new Error("SMTP non configurato: impossibile inviare la risposta via email.");
  }

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: segnalazione.autoreEmail,
    subject: "Risposta alla tua segnalazione",
    text: `Avevi scritto:\n"${segnalazione.testo}"\n\nRisposta:\n${rispostaTesto}`,
    html: `<p>Avevi scritto:</p><blockquote>${escapeHtml(segnalazione.testo).replace(/\n/g, "<br>")}</blockquote><p>Risposta:</p><p>${escapeHtml(rispostaTesto).replace(/\n/g, "<br>")}</p>`,
  });
}

// Notifica l'indirizzo configurato in /admin/segnalazioni (chiave impostazioni
// email_notifica_segnalazioni) che è arrivata una nuova segnalazione dal form
// pubblico. Stesso stile "best effort" di inviaNotificaModulo: non lancia mai in
// caso di SMTP non configurato o destinatario assente, è il chiamante (inviaSegnalazione
// in (site)/suggerimenti/actions.ts) a decidere se e come loggare un invio fallito,
// senza mai far fallire l'invio della segnalazione.
export async function inviaNotificaSegnalazione(testo: string, autore: string | null): Promise<void> {
  const imp = await getImpostazioni();
  const email = imp["email_notifica_segnalazioni"] || "";
  if (!email) return;
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    console.warn("[mail] SMTP non configurato: notifica nuova segnalazione non inviata.");
    return;
  }

  const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const link = `${baseUrl}/admin/segnalazioni`;

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: email,
    subject: "Nuova segnalazione ricevuta",
    text: `Da: ${autore || "Anonimo"}\n\n${testo}\n\nVai al pannello per rispondere: ${link}`,
    html: `<p><strong>Da:</strong> ${escapeHtml(autore || "Anonimo")}</p><p>${escapeHtml(testo).replace(/\n/g, "<br>")}</p><p><a href="${link}">Vai al pannello per rispondere</a></p>`,
  });
}

// "data" è già una stringa "YYYY-MM-DD" (DATE puro, nessun fuso orario in gioco,
// vedi commento su PRENOTAZIONE_SALA_COLS in lib/data.ts): formattata qui a mano
// invece che con new Date(...).toLocaleDateString(...) per non introdurre una
// conversione di fuso non necessaria su un valore che già non ne ha.
function formatDataItaliana(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Placeholder disponibili nel messaggio personalizzato di ogni sala (vedi textarea
// in admin/prenotazioni-sale/page.tsx): sostituiti con i dati della prenotazione
// appena creata, così il testo non è fisso ma si aggiorna da solo ad ogni invio.
function applicaPlaceholder(testo: string, prenotazione: PrenotazioneSala): string {
  return testo
    .replace(/\{\{\s*nome\s*\}\}/gi, prenotazione.richiedente)
    .replace(/\{\{\s*motivazione\s*\}\}/gi, prenotazione.note || "non specificata")
    .replace(/\{\{\s*data\s*\}\}/gi, formatDataItaliana(prenotazione.data));
}

// Notifica il destinatario configurato per la sala che è arrivata una nuova
// prenotazione. Stesso stile "best effort" di inviaNotificaModulo: non lancia mai
// in caso di SMTP non configurato o destinatario assente, è il chiamante (l'azione
// pubblica di prenotazione) a decidere se e come loggare un eventuale invio fallito,
// senza mai far fallire la prenotazione. Il messaggio personalizzato dell'admin
// (sala.messaggioNotifica, con eventuali placeholder {{nome}}/{{motivazione}}/{{data}} già
// sostituiti) viene anteposto ai dettagli della prenotazione, generati automaticamente.
export async function inviaNotificaPrenotazione(
  sala: Sala,
  prenotazione: PrenotazioneSala
): Promise<void> {
  if (!sala.emailNotifica) return;
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    console.warn(
      `[mail] SMTP non configurato: notifica prenotazione "${sala.nome}" non inviata.`
    );
    return;
  }

  const messaggio = sala.messaggioNotifica
    ? applicaPlaceholder(sala.messaggioNotifica, prenotazione)
    : "";
  const dettagli =
    `Sala: ${sala.nome}\n` +
    `Data: ${formatDataItaliana(prenotazione.data)}\n` +
    `Orario: dalle ${prenotazione.oraInizio} alle ${prenotazione.oraFine}\n` +
    `Richiesta da: ${prenotazione.richiedente}`;
  const testo = messaggio ? `${messaggio}\n\n${dettagli}` : dettagli;
  const html =
    (messaggio ? `<p>${escapeHtml(messaggio).replace(/\n/g, "<br>")}</p>` : "") +
    `<p>${escapeHtml(dettagli).replace(/\n/g, "<br>")}</p>`;

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: sala.emailNotifica,
    subject: `Nuova prenotazione: ${sala.nome}`,
    text: testo,
    html,
  });
}

const ETICHETTE_ASSISTENZA: Record<"tecnica" | "informatica", string> = {
  tecnica: "assistenza tecnica",
  informatica: "assistenza informatica",
};

// Notifica separata dalla notifica per sala sopra: parte solo se chi prenota ha
// spuntato il relativo flag ("Mi serve assistenza Tecnica/Informatica" nello step
// di conferma) e un destinatario è configurato in /admin/prenotazioni-sale (chiavi
// impostazioni email_assistenza_tecnica/email_assistenza_informatica — globali,
// non per sala: lo stesso team risponde indipendentemente da quale sala). Stesso
// stile "best effort" di inviaNotificaPrenotazione: non lancia mai in caso di SMTP
// non configurato o destinatario assente.
export async function inviaNotificaAssistenza(
  tipo: "tecnica" | "informatica",
  prenotazione: PrenotazioneSala
): Promise<void> {
  const imp = await getImpostazioni();
  const email = imp[`email_assistenza_${tipo}`] || "";
  if (!email) return;
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    console.warn(
      `[mail] SMTP non configurato: notifica ${ETICHETTE_ASSISTENZA[tipo]} non inviata.`
    );
    return;
  }

  const dettaglioRichiesta =
    tipo === "tecnica" ? prenotazione.assistenzaTecnicaDettaglio : prenotazione.assistenzaInformaticaDettaglio;
  const dettagli =
    `Sala: ${prenotazione.salaNome}\n` +
    `Data: ${formatDataItaliana(prenotazione.data)}\n` +
    `Orario: dalle ${prenotazione.oraInizio} alle ${prenotazione.oraFine}\n` +
    `Richiesta da: ${prenotazione.richiedente}\n` +
    `Oggetto della riunione: ${prenotazione.note || "non specificato"}\n` +
    `Cosa serve: ${dettaglioRichiesta || "non specificato"}`;

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: email,
    subject: `Richiesta ${ETICHETTE_ASSISTENZA[tipo]}: ${prenotazione.salaNome}`,
    text: dettagli,
    html: `<p>${escapeHtml(dettagli).replace(/\n/g, "<br>")}</p>`,
  });
}

// L'indirizzo della reception per "Di chi è?" si imposta in /admin/impostazioni
// (chiave ente_email_accoglienza, vedi lib/branding.ts): è sempre lo stesso ufficio
// che ha registrato il pacco e deve sapere chi è passato a dichiararlo suo.

// Notifica la reception che qualcuno ha dichiarato di essere il destinatario di
// un pacco in attesa. Stesso stile "best effort" di inviaNotificaSegnalazione:
// non lancia mai in caso di SMTP non configurato, è il chiamante
// (rivendicaPaccoAction in (site)/di-chi-e/[id]/actions.ts) a decidere se e come
// loggare un invio fallito — la dichiarazione resta comunque salvata in DB e
// consultabile da /admin/pacchi anche se questa email non parte.
export async function inviaNotificaPaccoRivendicato(
  pacco: Pacco,
  nome: string,
  email: string
): Promise<void> {
  const emailAccoglienza = brandingDa(await getImpostazioni()).emailAccoglienza;
  if (!emailAccoglienza) {
    console.warn(`[mail] Email accoglienza non configurata (/admin/impostazioni): notifica pacco rivendicato (${pacco.id}) non inviata.`);
    return;
  }
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    console.warn(`[mail] SMTP non configurato: notifica pacco rivendicato (${pacco.id}) non inviata.`);
    return;
  }

  const dettagli =
    `Pacco arrivato il ${formatDataItaliana(pacco.dataArrivo)}\n` +
    `Mittente: ${pacco.mittente || "non specificato"}\n` +
    `Descrizione: ${pacco.descrizione || "non specificata"}\n\n` +
    `${nome} dichiara che è suo${email ? ` (${email})` : ""}.`;

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: emailAccoglienza,
    subject: `Pacco rivendicato da ${nome}`,
    text: dettagli,
    html: `<p>${escapeHtml(dettagli).replace(/\n/g, "<br>")}</p>`,
  });
}

// Email di prova inviata dal form SMTP in /admin/impostazioni, per verificare la
// configurazione subito dopo averla salvata invece di scoprirla al primo invio reale
// (modulo o risposta segnalazione). Lancia sempre in caso di problemi: il chiamante
// (inviaEmailProvaAction in app/admin/actions.ts) mostra l'errore così com'è in UI.
export async function inviaEmailProva(destinatario: string): Promise<void> {
  const cfg = await resolveSmtpConfig();
  if (!smtpConfigurato(cfg)) {
    throw new Error("SMTP non configurato: compila almeno l'host prima di inviare una prova.");
  }

  await buildTransporter(cfg).sendMail({
    from: cfg.from,
    to: destinatario,
    subject: "Email di prova — Intranet",
    text: "Se hai ricevuto questa email, la configurazione SMTP è corretta.",
    html: "<p>Se hai ricevuto questa email, la configurazione SMTP è corretta.</p>",
  });
}
