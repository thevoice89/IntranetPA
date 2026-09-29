import sanitizeHtml from "sanitize-html";

// Unica sorgente ammessa per le <img> nel testo: il nostro storage.
const URL_IMMAGINE = /^\/api\/immagine\/[A-Za-z0-9-]+$/;

// Sanifica l'HTML prodotto dal RichTextEditor (descrizione modulo, blocchi
// "testo informativo", corpo delle comunicazioni) prima di salvarlo: è l'unico
// punto di scrittura per questi campi, quindi basta sanificare qui perché sia
// sicuro renderizzarli con dangerouslySetInnerHTML ovunque vengano letti.
// Whitelist minima, coerente con i comandi offerti dalla toolbar dell'editor.
//
// exclusiveFilter fa due cose:
//  - scarta le <img> che non provengono dal nostro storage (l'unica sorgente
//    ammessa è /api/immagine/<id>, alimentata da caricaImmagineTesto): niente
//    hotlink a siti esterni, niente immagini-traccianti incollate da fuori;
//  - rimuove i <p>/<div> vuoti che execCommand lascia in giro come artefatto
//    quando si trasforma un intero paragrafo in elenco (bug noto: circonda
//    l'<ul> col vecchio <p>, il parser HTML lo spacca in
//    "<p></p><ul>...</ul><p></p>" — verificato con node prima di questo fix).
//    mediaChildren esclude dal conteggio i paragrafi che contengono solo
//    un'immagine: hanno testo vuoto ma non vanno buttati (exclusiveFilter
//    elimina il tag *con tutto il contenuto*).
const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "b", "strong", "i", "em", "u", "s", "strike",
    "p", "br", "div", "ul", "ol", "li", "a", "h2", "h3", "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    // Solo per l'allineamento: allowedStyles più sotto scarta ogni altra
    // proprietà (un style="position:fixed" su tutto schermo, per dire).
    "*": ["style"],
  },
  allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === "img") return !URL_IMMAGINE.test(frame.attribs.src ?? "");
    return (frame.tag === "p" || frame.tag === "div") &&
      !frame.text.trim() &&
      frame.mediaChildren.length === 0;
  },
};

export function sanitizeRicco(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_SANITIZE_OPTIONS).trim();
}

// Tag generati dal RichTextEditor: la loro presenza distingue un corpo già
// formattato da uno scritto quando il campo era una semplice textarea.
const TAG_RICCO = /<(?:p|div|br|ul|ol|li|b|strong|i|em|u|s|strike|a|h2|h3|img)\b[^>]*>/i;

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Corpo di una comunicazione pronto per dangerouslySetInnerHTML.
//
// Serve perché il campo convive in due formati: le comunicazioni scritte con
// l'editor ricco contengono HTML, quelle più vecchie (e quelle inviate dal form
// pubblico della bacheca non ufficiale, che resta una textarea) sono testo
// semplice, dove gli a capo vanno resi con <p>/<br> o sparirebbero.
//
// Il testo semplice viene prima escapato — arriva anche da utenti non loggati,
// e senza escape un "<img onerror=…>" scritto a mano nella bacheca diventerebbe
// HTML vero — e in ogni caso si passa da sanitizeRicco: il salvataggio in DB è
// già sanificato, ma i corpi storici non lo sono mai stati.
export function corpoComunicazioneHtml(corpo: string): string {
  const testo = corpo.trim();
  if (!testo) return "";
  const html = TAG_RICCO.test(testo)
    ? testo
    : testo
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map((paragrafo) => `<p>${escapeHtml(paragrafo).replace(/\n/g, "<br>")}</p>`)
        .join("");
  return sanitizeRicco(html);
}
