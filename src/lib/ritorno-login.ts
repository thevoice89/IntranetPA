// Ritorno alla pagina richiesta dopo il login.
//
// src/middleware.ts copia il percorso di ogni richiesta nell'header
// HEADER_PERCORSO_RICHIESTO; requireUser() (lib/auth.ts) lo usa per mandare al
// login con ?next=<percorso>, e loginAction riporta lì dopo l'accesso invece
// che sempre in /admin. Nessuna dipendenza server (DB, node:crypto): lo
// importa anche il middleware.

export const HEADER_PERCORSO_RICHIESTO = "x-percorso-richiesto";

// Accetta solo percorsi dello stesso sito ("/moduli/abc?x=1"). Scarta "//host"
// e "/\host" (i browser li leggono come indirizzi di un altro sito), spazi e
// caratteri di controllo, e la pagina di login stessa.
export function percorsoInterno(valore: unknown): string | null {
  if (typeof valore !== "string" || !valore.startsWith("/") || valore.startsWith("//")) {
    return null;
  }
  if (/[\s\\]/.test(valore) || [...valore].some((ch) => ch < " " || ch === "\x7f")) {
    return null;
  }
  if (valore.split(/[?#]/)[0].replace(/\/+$/, "") === "/admin/login") return null;
  return valore;
}
