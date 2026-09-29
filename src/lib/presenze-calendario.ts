// Helpers di calendario condivisi tra /admin/presenze e il widget "Presenze
// del team" in dashboard (/admin): stessa tabella mensile a bollini, stesso
// calcolo del giorno odierno, per non duplicarli tra le due viste.
import type { StatoPresenza } from "@/types";

export const NOMI_MESE = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
export const NOMI_GIORNO = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Giorni ISO "YYYY-MM-DD" del mese, calcolati in locale (evita le insidie dei
// fusi orari con Date.parse).
export function giorniDelMese(anno: number, mese: number): string[] {
  const nGiorni = new Date(anno, mese, 0).getDate();
  return Array.from({ length: nGiorni }, (_, i) =>
    `${anno}-${String(mese).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
  );
}

export function formatGiornoColonna(iso: string): { giorno: number; settimana: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return { giorno: d, settimana: NOMI_GIORNO[idx][0] };
}

export function dotClass(stato: StatoPresenza | null): string {
  if (stato === "assente") return "presenza-dot--assente";
  if (stato === "smartworking") return "presenza-dot--smartworking";
  return "presenza-dot--presente";
}

export function labelStato(stato: StatoPresenza | null): string {
  if (stato === "assente") return "Assente";
  if (stato === "smartworking") return "Smart working";
  return "Presente";
}

// Data odierna in Europe/Rome, non nel fuso del container (UTC): usata per
// evidenziare la colonna di oggi in tabella. Definita in lib/format.ts, dove
// la usano anche gli altri calcoli di "oggi" lato server.
export { oggiIso } from "@/lib/format";
