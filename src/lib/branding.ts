// Identità dell'ente (nome, stemma, logo, luogo nei PDF, email accoglienza, meteo):
// tutto modificabile da /admin/impostazioni e salvato nella tabella `impostazioni`
// (chiave/valore, vedi lib/data.ts). Una chiave assente o vuota = si usa il default
// qui sotto, così un'installazione nuova funziona subito con i segnaposto e l'ente
// li sostituisce dal pannello, senza toccare il codice né rifare la build.
//
// Modulo "puro" (nessun accesso a DB o file): chi ha già letto le impostazioni le
// passa a brandingDa(); il caricamento dei file caricati sta in lib/pdf-logo.ts e
// nella route /api/branding/[tipo].

export const CHIAVI_BRANDING = {
  nome: "ente_nome",
  luogo: "ente_luogo",
  emailAccoglienza: "ente_email_accoglienza",
  stemmaFile: "ente_stemma_file",
  logoFile: "ente_logo_file",
  meteoLatitudine: "meteo_latitudine",
  meteoLongitudine: "meteo_longitudine",
  meteoUrl: "meteo_url",
} as const;

export const DEFAULT_BRANDING = {
  nome: "Comune di Esempio",
  luogo: "Esempio",
  // Vuoto di proposito: senza un indirizzo configurato la notifica "pacco
  // rivendicato" non parte (resta comunque visibile in /admin/pacchi).
  emailAccoglienza: "",
  stemmaPubblico: "/stemma.png",
  logoPubblico: "/logo.png",
  // Roma: l'esempio del progetto, da sostituire con le coordinate del proprio comune.
  meteoLatitudine: 41.9028,
  meteoLongitudine: 12.4964,
  meteoUrl: "https://www.3bmeteo.com/meteo/roma",
} as const;

// Immagini caricabili da pannello: `tipo` compare nell'URL /api/branding/<tipo>.
export type TipoImmagineEnte = "stemma" | "logo";

export const IMMAGINI_ENTE: Record<
  TipoImmagineEnte,
  { chiaveFile: string; etichetta: string; maxLato: number }
> = {
  // maxLato: lato massimo (px) a cui il browser ridimensiona prima dell'upload.
  // Il logo finisce incorporato in ogni PDF generato: 960px bastano per la stampa
  // e tengono i PDF leggeri (un logo a 2688px ne gonfia ogni copia di ~1 MB).
  stemma: { chiaveFile: CHIAVI_BRANDING.stemmaFile, etichetta: "Stemma", maxLato: 720 },
  logo: { chiaveFile: CHIAVI_BRANDING.logoFile, etichetta: "Logo", maxLato: 960 },
};

export function eTipoImmagineEnte(v: string): v is TipoImmagineEnte {
  return v === "stemma" || v === "logo";
}

export interface Branding {
  nome: string;
  luogo: string;
  emailAccoglienza: string;
  // Percorso da mettere in <img src>: l'upload dell'ente (con ?v=<file> per
  // invalidare la cache quando cambia) oppure il file predefinito in /public.
  stemmaUrl: string;
  logoUrl: string;
  // true se l'ente ha caricato una propria immagine (serve alla UI per
  // mostrare "Ripristina predefinito").
  stemmaPersonalizzato: boolean;
  logoPersonalizzato: boolean;
  meteo: { latitudine: number; longitudine: number; url: string };
}

function testo(imp: Record<string, string>, chiave: string): string {
  return (imp[chiave] ?? "").trim();
}

// Le coordinate valgono solo come coppia: una sola delle due darebbe un punto
// a metà tra il comune e il default, quindi in quel caso si usa il default per entrambe.
function posizioneMeteo(imp: Record<string, string>): { latitudine: number; longitudine: number } {
  const lat = testo(imp, CHIAVI_BRANDING.meteoLatitudine).replace(",", ".");
  const lon = testo(imp, CHIAVI_BRANDING.meteoLongitudine).replace(",", ".");
  if (coordinataValida(lat, 90) && coordinataValida(lon, 180)) {
    return { latitudine: Number(lat), longitudine: Number(lon) };
  }
  return { latitudine: DEFAULT_BRANDING.meteoLatitudine, longitudine: DEFAULT_BRANDING.meteoLongitudine };
}

function urlImmagine(tipo: TipoImmagineEnte, imp: Record<string, string>, pubblico: string) {
  const file = testo(imp, IMMAGINI_ENTE[tipo].chiaveFile);
  return file
    ? { url: `/api/branding/${tipo}?v=${encodeURIComponent(file)}`, personalizzato: true }
    : { url: pubblico, personalizzato: false };
}

export function brandingDa(imp: Record<string, string>): Branding {
  const stemma = urlImmagine("stemma", imp, DEFAULT_BRANDING.stemmaPubblico);
  const logo = urlImmagine("logo", imp, DEFAULT_BRANDING.logoPubblico);
  return {
    nome: testo(imp, CHIAVI_BRANDING.nome) || DEFAULT_BRANDING.nome,
    // Vuoto = default: i PDF non escono mai con la data preceduta da una virgola sola.
    luogo: testo(imp, CHIAVI_BRANDING.luogo) || DEFAULT_BRANDING.luogo,
    emailAccoglienza: testo(imp, CHIAVI_BRANDING.emailAccoglienza),
    stemmaUrl: stemma.url,
    stemmaPersonalizzato: stemma.personalizzato,
    logoUrl: logo.url,
    logoPersonalizzato: logo.personalizzato,
    meteo: {
      ...posizioneMeteo(imp),
      url: testo(imp, CHIAVI_BRANDING.meteoUrl) || DEFAULT_BRANDING.meteoUrl,
    },
  };
}

// ----------------------------- validazioni -----------------------------

export function emailValida(v: string): boolean {
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(v);
}

export function urlHttpValido(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function coordinataValida(v: string, max: number): boolean {
  if (v === "") return false;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) <= max;
}

// Limiti per le immagini caricate: PNG (il browser converte qualsiasi formato in
// PNG prima dell'invio, vedi ImmagineEnteForm) entro 2 MB e 2000 px per lato.
// Solo PNG, mai SVG: è un documento XML che può contenere script.
export const MAX_BYTE_IMMAGINE_ENTE = 2 * 1024 * 1024;
const MAX_LATO_IMMAGINE_ENTE = 2000;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Larghezza/altezza dal blocco IHDR (offset 16 e 20) dopo aver controllato la
// firma PNG; null se il buffer non è un PNG. Senza decodificare l'immagine.
export function dimensioniPng(buf: Buffer): { larghezza: number; altezza: number } | null {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(FIRMA_PNG) || buf.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return { larghezza: buf.readUInt32BE(16), altezza: buf.readUInt32BE(20) };
}

export function verificaPng(buf: Buffer): { ok: true } | { ok: false; errore: string } {
  if (buf.length > MAX_BYTE_IMMAGINE_ENTE) {
    return { ok: false, errore: "L'immagine supera i 2 MB." };
  }
  const dim = dimensioniPng(buf);
  if (!dim) return { ok: false, errore: "Il file non è un'immagine PNG valida." };
  const { larghezza, altezza } = dim;
  if (larghezza < 16 || altezza < 16 || larghezza > MAX_LATO_IMMAGINE_ENTE || altezza > MAX_LATO_IMMAGINE_ENTE) {
    return { ok: false, errore: `Le dimensioni devono stare tra 16 e ${MAX_LATO_IMMAGINE_ENTE} px per lato.` };
  }
  return { ok: true };
}
