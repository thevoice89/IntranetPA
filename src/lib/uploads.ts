import { writeFile, mkdir, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Storage dei file caricati. La cartella è montata su un volume Docker
// (vedi docker-compose.yml) così i file sopravvivono ai riavvii.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

export async function saveUpload(
  file: File
): Promise<{ storedName: string; mime: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return { storedName, mime: file.type || "application/octet-stream" };
}

export async function readUpload(storedName: string): Promise<Buffer> {
  // path.basename previene path traversal.
  return readFile(path.join(UPLOAD_DIR, path.basename(storedName)));
}

export async function deleteUpload(storedName: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, path.basename(storedName)));
  } catch {
    // file già assente: ignora.
  }
}

// Formati che il browser mostra senza eseguire nulla: gli unici serviti inline.
// Niente SVG (è un documento XML che può contenere script).
const IMMAGINI_INLINE = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/avif",
]);

function isInlineSicuro(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "text/plain" ||
    IMMAGINI_INLINE.has(mime) ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  );
}

// Risposta HTTP per un file caricato, usata da tutte le route /api che servono
// il volume uploads. Il MIME salvato arriva dal browser di chi ha caricato il
// file (file.type in saveUpload), quindi non è affidabile: un .html dichiarato
// "text/html" e servito inline girerebbe come pagina del sito, con la sessione
// di chi lo apre — admin compreso, che apre gli allegati delle compilazioni
// anonime dei moduli. Per questo:
//  - inline solo i formati di isInlineSicuro (PDF, immagini raster, audio,
//    video, testo), come prima;
//  - tutto il resto parte come download, con Content-Type neutro;
//  - nosniff impedisce al browser di "indovinare" un tipo diverso da quello
//    dichiarato.
// Il controllo è qui, al momento di servire, e non in saveUpload: così copre
// anche i file già caricati prima di questa correzione.
export function rispostaUpload(
  buffer: Buffer,
  opzioni: {
    // Nome del file sul volume: se ne ricava l'estensione da aggiungere a
    // `nome` quando manca (un download "application/octet-stream" senza
    // estensione non si aprirebbe più con doppio clic).
    fileName: string;
    mime: string | null | undefined;
    // Nome proposto al browser. Omesso: nessun Content-Disposition per i
    // formati inline (immagini mostrate in un <img>).
    nome?: string;
    // Download anche per i formati inline (es. Carta Intestata).
    sempreDownload?: boolean;
    cacheControl: string;
  }
): Response {
  const mime = (opzioni.mime ?? "").split(";")[0].trim().toLowerCase();
  const sicuro = isInlineSicuro(mime);
  const inline = sicuro && !opzioni.sempreDownload;

  const headers: Record<string, string> = {
    "Content-Type": sicuro ? mime : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": opzioni.cacheControl,
  };

  if (!inline || opzioni.nome) {
    const ext = path.extname(opzioni.fileName);
    const base = opzioni.nome || "file";
    const nome = ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? base + ext : base;
    headers["Content-Disposition"] = contentDisposition(inline ? "inline" : "attachment", nome);
  }

  return new Response(new Uint8Array(buffer), { headers });
}

// Nome file nel Content-Disposition secondo RFC 6266: filename*= con il nome
// vero in UTF-8 (accenti compresi), filename= con un ripiego solo ASCII per i
// client che non conoscono il primo. Con il solo filename="<percent-encoded>"
// usato prima, Firefox salvava il file come "Circolare%20ferie.pdf".
function contentDisposition(tipo: "inline" | "attachment", nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const utf8 = encodeURIComponent(nome).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
