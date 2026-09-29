// Utility di formattazione condivise.

import type { Comunicazione } from "@/types";

const formatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

// Converte una data ISO ("2026-06-12") in formato leggibile ("12 giugno 2026").
export function formatData(iso: string): string {
  return formatter.format(new Date(iso));
}

// Data odierna "YYYY-MM-DD" in Europe/Rome. Il container gira in UTC: con
// new Date().toISOString() o getDate() tra mezzanotte e l'1/le 2 italiane
// risulterebbe ancora il giorno prima (vedi il fix orari del 30/7).
export function oggiIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

// Orario di un evento del calendario in forma leggibile. Gli orari sono
// facoltativi sia negli eventi inseriti nel calendario sia in quelli fissati
// nelle comunicazioni: senza ora di inizio l'evento occupa l'intera giornata,
// con la sola ora di inizio non si inventa una durata.
export function formatOrarioEvento(oraInizio: string | null, oraFine: string | null): string {
  if (!oraInizio) return "Tutto il giorno";
  return oraFine ? `${oraInizio}–${oraFine}` : `dalle ${oraInizio}`;
}

// Vero se la comunicazione va mostrata "in evidenza": flag manuale attivo,
// oppure promemoria impostato con data odierna o già passata. Il promemoria
// permette di scrivere oggi una comunicazione su un fatto futuro (es. un
// evento fra due settimane) e farla comparire in evidenza in home solo a
// ridosso della data, invece di doverla marcare manualmente da subito.
// evidenzaFine chiude il periodo (qualunque dei due percorsi l'abbia attivata):
// se impostata e già passata, l'evidenza si considera terminata anche con la
// spunta "in evidenza" ancora attiva.
export function mostraInEvidenza(
  c: Pick<Comunicazione, "inEvidenza" | "promemoriaData" | "evidenzaFine">
): boolean {
  const oggi = oggiIso();
  const attiva = c.inEvidenza || (c.promemoriaData !== null && c.promemoriaData <= oggi);
  if (!attiva) return false;
  return c.evidenzaFine === null || oggi <= c.evidenzaFine;
}
