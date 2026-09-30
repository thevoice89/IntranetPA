import path from "node:path";
import { readFile } from "node:fs/promises";
import { getImpostazioni } from "@/lib/data";
import { readUpload } from "@/lib/uploads";
import { CHIAVI_BRANDING, dimensioniPng } from "@/lib/branding";

// Logo d'intestazione dei PDF generati (modulo-pdf.ts, compilazione-pdf.ts): quello
// caricato dall'ente da /admin/impostazioni, altrimenti il segnaposto in
// src/lib/pdf-assets. Path assoluto letto a runtime (non un import): vedi il
// commento in compilazione-pdf.ts e outputFileTracingIncludes in next.config.mjs.
const LOGO_PREDEFINITO = path.join(process.cwd(), "src/lib/pdf-assets/logo.png");

// Riquadro massimo (pt) in cui il logo viene inserito nell'intestazione: 220×88 è
// esattamente il logo predefinito (960×384), mentre un logo di altre proporzioni
// (più quadrato, più alto) viene rimpicciolito per restare nel riquadro invece di
// spingere il titolo fuori pagina.
const LARGHEZZA_MAX = 220;
const ALTEZZA_MAX = 88;

export interface LogoPdf {
  buffer: Buffer;
  // Dimensioni effettive (pt) con cui verrà disegnato: `width`/`height` da passare
  // a doc.image() e altezza da sommare a doc.y per proseguire sotto il logo.
  width: number;
  height: number;
}

async function leggiBuffer(): Promise<Buffer> {
  let personalizzato = "";
  try {
    personalizzato = (await getImpostazioni())[CHIAVI_BRANDING.logoFile] ?? "";
  } catch {
    // DB non raggiungibile: il PDF si genera comunque col logo predefinito.
  }
  if (personalizzato) {
    try {
      const buf = await readUpload(personalizzato);
      if (dimensioniPng(buf)) return buf;
    } catch {
      // file sparito dal volume: ripiego sul predefinito.
    }
  }
  return readFile(LOGO_PREDEFINITO);
}

export async function caricaLogoPdf(): Promise<LogoPdf> {
  const buffer = await leggiBuffer();
  const dim = dimensioniPng(buffer) ?? { larghezza: 960, altezza: 384 };
  const scala = Math.min(LARGHEZZA_MAX / dim.larghezza, ALTEZZA_MAX / dim.altezza);
  return { buffer, width: dim.larghezza * scala, height: dim.altezza * scala };
}
