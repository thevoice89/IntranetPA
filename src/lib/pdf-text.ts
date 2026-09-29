import "./pdf-canvas-polyfill";
import { PDFParse } from "pdf-parse";

// Estrae il testo semplice da un PDF per indicizzarlo nella ricerca.
// Non blocca il caricamento del regolamento: in caso di PDF illeggibile
// (scansione senza OCR, file corrotto, ecc.) restituisce stringa vuota.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } catch {
    return "";
  } finally {
    await parser.destroy();
  }
}
