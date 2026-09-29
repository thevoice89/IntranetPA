// pdfjs-dist (usato da pdf-parse) referenzia DOMMatrix/ImageData/Path2D a
// livello di modulo anche quando serve solo estrarre testo (nessun
// rendering). Il pacchetto nativo opzionale che le fornirebbe
// (@napi-rs/canvas) non ha build per Alpine/musl: senza questo stub il
// solo `require("pdf-parse")` lancia "DOMMatrix is not defined".
// Va importato PRIMA di "pdf-parse" (vedi pdf-text.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
// Stub minimi (non serve una implementazione reale, solo che il simbolo
// esista: usiamo esclusivamente l'estrazione testo, mai il rendering).
const g = globalThis as any;
g.DOMMatrix ??= class DOMMatrix {};
g.ImageData ??= class ImageData {};
g.Path2D ??= class Path2D {};
