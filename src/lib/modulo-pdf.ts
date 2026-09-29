import path from "node:path";
import PDFDocument from "pdfkit";
import type { Modulo, ModuloCampo } from "@/types";

// Stessi asset di compilazione-pdf.ts (vedi lì per il motivo del path assoluto
// letto a runtime e del font passato subito a PDFDocument).
const PDF_ASSETS_DIR = path.join(process.cwd(), "src/lib/pdf-assets");
const FONT_REGULAR = path.join(PDF_ASSETS_DIR, "fonts/trebuchet-regular.ttf");
const FONT_BOLD = path.join(PDF_ASSETS_DIR, "fonts/trebuchet-bold.ttf");
const LOGO_PATH = path.join(PDF_ASSETS_DIR, "logo.png");
const LOGO_ASPECT = 384 / 960;

function formatDataOggi(): string {
  return new Date().toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

// Data e ora (con i minuti) del momento in cui il PDF viene generato, per la
// traccia digitale sotto la firma — a differenza di formatDataOggi() sopra
// (solo la data, per l'intestazione in stile lettera cartacea) qui serve
// anche l'orario, quindi le due non sono unificabili.
function formatDataOraGenerazione(): string {
  const ora = new Date();
  const data = ora.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
  const orario = ora.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  return `${data} alle ${orario}`;
}

// Un <input type="date"> posta sempre "YYYY-MM-DD": dentro un elenco
// domanda/risposta si legge bene così, ma inserito in mezzo a una frase in
// prosa ("nato/a il 1985-04-12") stona. Qui viene riscritto in italiano
// esteso ("12 aprile 1985") solo per i campi di tipo "data" nel corpo lettera.
function formatDataItaliano(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Un <input type="number"> posta sempre il punto come separatore decimale
// ("15.5"): riscritto con la virgola italiana solo per i campi di tipo
// "numero" nel corpo lettera, stesso trattamento di formatDataItaliano sopra.
// Non forza due decimali (un "numero" generico, es. "anni di corso", non è
// per forza una cifra in euro): un valore non numerico resta invariato.
function formatNumeroItaliano(valore: string): string {
  const n = Number(valore);
  return Number.isFinite(n) ? n.toLocaleString("it-IT") : valore;
}

// Sostituisce ogni {{Etichetta}} nel corpo con il valore compilato per il campo
// con quella identica etichetta. Etichette duplicate (es. "Nato/a il" ripetuto
// per due persone diverse nello stesso modulo) vengono abbinate in ordine di
// comparsa — sia nell'elenco campi sia nel testo — funziona perché entrambi gli
// ordini sono decisi da chi scrive il modulo. Un campo senza risposta diventa
// una riga di puntini, per leggersi come uno spazio del cartaceo lasciato vuoto
// invece che come un errore.
function sostituisciPlaceholder(
  corpo: string,
  campi: ModuloCampo[],
  valori: Map<string, string>
): string {
  const codaPerEtichetta = new Map<string, string[]>();
  for (const c of campi) {
    if (c.tipo === "testo_statico") continue;
    let valore = (valori.get(c.id) ?? "").trim();
    if (valore && c.tipo === "data") valore = formatDataItaliano(valore);
    if (valore && c.tipo === "numero") valore = formatNumeroItaliano(valore);
    const lista = codaPerEtichetta.get(c.etichetta) ?? [];
    lista.push(valore || "…………………");
    codaPerEtichetta.set(c.etichetta, lista);
  }
  return corpo.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, etichetta) => {
    const coda = codaPerEtichetta.get(etichetta);
    if (!coda || coda.length === 0) return match;
    return coda.shift()!;
  });
}

// Una riga (dentro un paragrafo multi-riga, es. un elenco di voci facoltative
// come i giustificativi di spesa del Modulo Missione) è "vuota" se, tolti i
// riempitivi "…………………" e i soli connettori statici tipici di queste righe
// (trattini, due punti, simbolo euro, punteggiatura, il bullet "•"), non resta
// alcun testo vero: in tal caso la riga va omessa del tutto invece di comparire
// come una sequenza di puntini — utile per un elenco dove non tutte le voci
// sono compilate, a differenza del riempitivo puntinato usato altrove per un
// singolo campo facoltativo isolato in mezzo alla prosa.
const CONNETTORI_RIGA = /[\s\-–—•:€().,]/g;
function rigaVuota(riga: string): boolean {
  return riga.split("…………………").join("").replace(CONNETTORI_RIGA, "").length === 0;
}

// True per un paragrafo come "CHIEDE" o "DICHIARA": tutto maiuscolo, corto,
// su una riga sola — reso centrato e in grassetto come nei moduli cartacei
// originali, senza bisogno di un markup dedicato nel testo del corpo.
function eTitoletto(paragrafo: string): boolean {
  return paragrafo.length <= 24 && !paragrafo.includes("\n") && paragrafo === paragrafo.toUpperCase() && /[A-ZÀ-Þ]/.test(paragrafo);
}

// Primo campo la cui etichetta inizia con "Nome e cognome" (tutti i moduli
// "pdf" ne hanno uno, in testa o quasi: è la convenzione usata scrivendo le
// domande): il suo valore compilato va stampato sotto "Firma".
function trovaNomeCompilatore(campi: ModuloCampo[], valori: Map<string, string>): string {
  const campo = campi.find((c) => c.tipo !== "testo_statico" && /^nome e cognome/i.test(c.etichetta));
  return campo ? (valori.get(campo.id) ?? "").trim() : "";
}

// Genera il PDF di un modulo di tipo "pdf" (vedi TipoModulo in types/index.ts):
// una vera lettera — intestazione, data e destinatario, corpo in prosa con i
// placeholder del modulo sostituiti dai valori compilati, riga firma, nota a
// piè di pagina — non un elenco domanda/risposta. Nessun riferimento a "chi ha
// compilato"/"ricevuto il": a differenza di generateCompilazionePdf (usato dal
// backoffice per i moduli "form" salvati), qui non c'è nulla di salvato da
// tracciare, il documento è pensato per essere stampato e firmato a mano.
// `ip` (facoltativo, passato dalla route che ha accesso alla request) è
// stampato sotto la firma insieme a data e ora di generazione: non sostituisce
// una vera firma digitale, ma dà al cartaceo firmato a mano una traccia
// verificabile di quando e da dove è stato generato.
export function generateModuloPdfCompilato(
  modulo: Modulo,
  valori: Map<string, string>,
  ip?: string
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56, font: FONT_REGULAR });
  doc.registerFont("Trebuchet", FONT_REGULAR);
  doc.registerFont("Trebuchet-Bold", FONT_BOLD);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const fatto = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // --- Intestazione: solo il logo del Comune, senza riga separatrice ---
  const logoWidth = 220;
  doc.image(LOGO_PATH, left, doc.y, { width: logoWidth });
  doc.y += logoWidth * LOGO_ASPECT + 16;
  doc.moveDown(1.8);

  // --- Titolo del modulo, centrato come intestazione della lettera ---
  doc
    .font("Trebuchet-Bold")
    .fontSize(14)
    .fillColor("#14171f")
    .text(modulo.titolo, left, doc.y, { width, align: "center" });
  doc.moveDown(1.6);

  // --- Data e destinatario, allineati a destra come nel modulo cartaceo ---
  doc
    .font("Trebuchet")
    .fontSize(10)
    .fillColor("#14171f")
    .text(`Esempio, ${formatDataOggi()}`, left, doc.y, { width, align: "right" });
  doc.moveDown(1);
  if (modulo.pdfDestinatario) {
    doc.text(`Al ${modulo.pdfDestinatario}`, left, doc.y, { width, align: "right" });
    doc.text("Sede", left, doc.y, { width, align: "right" });
  }
  if (modulo.pdfDestinatarioPc) {
    doc.moveDown(0.6);
    doc.text(`E p.c.  Al ${modulo.pdfDestinatarioPc}`, left, doc.y, { width, align: "right" });
    doc.text("Sede", left, doc.y, { width, align: "right" });
  }
  doc.moveDown(1.8);

  // --- Corpo: prosa col template compilato, o un elenco domanda/risposta di
  //     riserva per un modulo "pdf" a cui non è stata ancora scritta una
  //     lettera (pdfCorpo vuoto) — mai un PDF vuoto o rotto. ---
  if (modulo.pdfCorpo.trim()) {
    const corpo = sostituisciPlaceholder(modulo.pdfCorpo, modulo.campi, valori);
    const paragrafi = corpo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragrafi) {
      if (eTitoletto(p)) {
        doc.font("Trebuchet-Bold").fontSize(11).fillColor("#14171f").text(p, left, doc.y, { width, align: "center" });
        doc.moveDown(0.9);
        continue;
      }
      const testo = p.includes("\n") ? p.split("\n").filter((riga) => !rigaVuota(riga)).join("\n") : p;
      if (!testo.trim()) continue;
      doc.font("Trebuchet").fontSize(10.5).fillColor("#14171f").text(testo, left, doc.y, { width, align: "justify", lineGap: 2 });
      doc.moveDown(0.9);
    }
  } else {
    for (const campo of modulo.campi) {
      if (campo.tipo === "testo_statico") continue;
      const valore = (valori.get(campo.id) ?? "").trim();
      // Un campo facoltativo lasciato vuoto (es. "Giorno 2" di un modulo che
      // ne prevede fino a 3) non compare affatto, invece di una riga con un
      // trattino: più pulito, e più vicino a un documento davvero compilato.
      if (!valore) continue;
      doc.font("Trebuchet-Bold").fontSize(10.5).fillColor("#14171f").text(campo.etichetta, left, doc.y, { width });
      doc.font("Trebuchet").fontSize(10).fillColor("#14171f").text(valore, left, doc.y, { width });
      doc.moveDown(0.8);
    }
  }

  // --- Riga firma, col nome di chi ha compilato subito sotto ---
  // pdfkit va a capo pagina automaticamente riga per riga: senza questo
  // controllo, un corpo lungo può lasciare il blocco finale (firma, traccia
  // digitale, nota) spezzato fra due pagine — es. solo l'ultima parola della
  // nota isolata a inizio pagina successiva. 135 stima firma+nome+riga+traccia
  // digitale (sempre presenti, altezza pressoché fissa); l'altezza della nota
  // invece varia parecchio da modulo a modulo, quindi qui viene misurata per
  // davvero con heightOfString invece di un'altra costante a occhio.
  doc.font("Trebuchet").fontSize(8);
  const altezzaNota = modulo.pdfNota.trim()
    ? doc.heightOfString(modulo.pdfNota, { width, lineGap: 1 }) + 1.6 * doc.currentLineHeight()
    : 0;
  const ALTEZZA_BLOCCO_FIRMA = 135 + altezzaNota;
  if (doc.y > doc.page.height - doc.page.margins.bottom - ALTEZZA_BLOCCO_FIRMA) {
    doc.addPage();
  }
  doc.moveDown(1.2);
  doc.font("Trebuchet").fontSize(10).fillColor("#14171f").text("Firma", left, doc.y, { width, align: "center" });
  const nomeCompilatore = trovaNomeCompilatore(modulo.campi, valori);
  if (nomeCompilatore) {
    doc.font("Trebuchet-Bold").fontSize(10).fillColor("#14171f").text(nomeCompilatore, left, doc.y, { width, align: "center" });
  }
  doc.moveDown(1.6);
  doc.font("Trebuchet").fontSize(10).fillColor("#14171f").text("_________________________________", left, doc.y, { width, align: "center" });

  // --- Traccia digitale (sempre presente, a differenza della nota sotto):
  //     data/ora di generazione + IP di chi ha inviato la richiesta. ---
  doc.moveDown(0.5);
  doc
    .font("Trebuchet")
    .fontSize(7.5)
    .fillColor("#6b7280")
    .text(
      `Documento generato elettronicamente il ${formatDataOraGenerazione()}${
        ip ? ` — richiesta inviata da ${ip}` : ""
      }.`,
      left,
      doc.y,
      { width, align: "center" }
    );

  // --- Nota a piè di pagina (facoltativa) ---
  if (modulo.pdfNota.trim()) {
    doc.moveDown(1.6);
    doc
      .font("Trebuchet")
      .fontSize(8)
      .fillColor("#6b7280")
      .text(modulo.pdfNota, left, doc.y, { width, align: "justify", lineGap: 1 });
  }

  doc.end();
  return fatto;
}
