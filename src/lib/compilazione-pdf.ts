import path from "node:path";
import PDFDocument from "pdfkit";
import type { ModuloCompilazione } from "@/types";
import { caricaLogoPdf } from "@/lib/pdf-logo";

// path hardcoded, letti a runtime: non passano da un import/require statico,
// quindi il tracing dell'output standalone non li rileva da solo (vedi
// outputFileTracingIncludes in next.config.mjs). I file restano fuori da
// "public" di proposito: il font va incorporato nei PDF generati (uso
// previsto dalla licenza), non servito come file scaricabile a sé. Il logo
// viene da lib/pdf-logo.ts: quello caricato dall'ente (già ridimensionato a
// 960px dal browser, vedi ImmagineEnteForm) o la copia predefinita in
// pdf-assets, non i 2688px di public/logo.png che gonfierebbero ogni PDF.
const PDF_ASSETS_DIR = path.join(process.cwd(), "src/lib/pdf-assets");
const FONT_REGULAR = path.join(PDF_ASSETS_DIR, "fonts/trebuchet-regular.ttf");
const FONT_BOLD = path.join(PDF_ASSETS_DIR, "fonts/trebuchet-bold.ttf");

function formatDataOra(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

// Genera il PDF in carta intestata di una compilazione ricevuta (domanda +
// risposta data, non il modulo in bianco): usato dal backoffice dell'ufficio
// per stampare/archiviare una copia ufficiale di quanto inviato.
export async function generateCompilazionePdf(c: ModuloCompilazione): Promise<Buffer> {
  const logo = await caricaLogoPdf();
  // "font" esplicito: pdfkit di default inizializza il documento con lo
  // standard "Helvetica", caricato da un path relativo a __dirname dentro
  // pdfkit stesso — path che si rompe quando webpack impacchetta il codice
  // di pdfkit dentro il bundle della route (ENOENT su .../data/Helvetica.afm
  // in produzione). Passare subito il nostro font evita del tutto quel path.
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

  // --- Intestazione: logo dell'ente + riga separatrice ---
  doc.image(logo.buffer, left, doc.y, { width: logo.width, height: logo.height });
  doc.y += logo.height + 16;
  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .strokeColor("#4f46e5")
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(1.2);

  // --- Titolo modulo + metadati compilazione ---
  doc.font("Trebuchet-Bold").fontSize(16).fillColor("#14171f").text(c.moduloTitolo);
  doc
    .font("Trebuchet")
    .fontSize(10)
    .fillColor("#6b7280")
    .text(`Modulo compilato · Ufficio ${c.ufficioNome}`);
  doc.moveDown(1);

  doc.font("Trebuchet-Bold").fontSize(8).fillColor("#9aa1ad").text("COMPILATO DA");
  doc
    .font("Trebuchet")
    .fontSize(11)
    .fillColor("#14171f")
    .text(c.nomeCompilatore || "Anonimo");
  if (c.emailCompilatore) {
    doc.font("Trebuchet").fontSize(10).fillColor("#4f46e5").text(c.emailCompilatore);
  }
  doc
    .font("Trebuchet")
    .fontSize(9)
    .fillColor("#6b7280")
    .text(`Ricevuto il ${formatDataOra(c.creatoIl)}`);
  doc.moveDown(1);

  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#e8eaee").lineWidth(1).stroke();
  doc.moveDown(1);

  // --- Domande e risposte ---
  if (c.risposte.length === 0) {
    doc.font("Trebuchet").fontSize(10).fillColor("#6b7280").text("Nessuna risposta registrata.");
  }
  for (const r of c.risposte) {
    doc.font("Trebuchet-Bold").fontSize(11).fillColor("#14171f").text(r.etichetta);
    if (r.allegato) {
      doc
        .font("Trebuchet")
        .fontSize(10)
        .fillColor("#4f46e5")
        .text(`Allegato: ${r.allegato.fileNameOriginale}`);
    } else {
      doc
        .font("Trebuchet")
        .fontSize(10)
        .fillColor("#14171f")
        .text(r.valore || "—");
    }
    doc.moveDown(0.8);
  }

  // --- Piè di pagina ---
  // Y dentro il margine inferiore (non oltre): un valore anche solo di
  // qualche punto oltre page.height - margins.bottom fa scattare
  // l'inserimento automatico di una nuova pagina in pdfkit, spostando il
  // piè di pagina da solo su una seconda pagina vuota.
  doc
    .font("Trebuchet")
    .fontSize(8)
    .fillColor("#9aa1ad")
    .text(
      `Documento generato automaticamente il ${formatDataOra(new Date().toISOString())} · ID compilazione ${c.id}`,
      left,
      doc.page.height - doc.page.margins.bottom - 20,
      { width: right - left, align: "center" }
    );

  doc.end();
  return fatto;
}
