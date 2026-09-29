// Hook ufficiale Next.js: gira una sola volta all'avvio del server, prima di
// qualunque route/chunk. Sostituisce l'import "a effetto" in pdf-canvas-polyfill.ts
// (src/lib/pdf-text.ts), che in produzione (standalone, Alpine) non garantiva
// di essere eseguito prima che pdfjs-dist controllasse `DOMMatrix` a livello di
// modulo — causando "DOMMatrix is not defined" su ogni route che importa,
// anche solo transitivamente, extractPdfText (quindi ogni pagina admin).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const g = globalThis as unknown as Record<string, unknown>;
    g.DOMMatrix ??= class DOMMatrix {};
    g.ImageData ??= class ImageData {};
    g.Path2D ??= class Path2D {};
  }
}
