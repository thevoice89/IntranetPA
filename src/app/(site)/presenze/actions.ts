"use server";

import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { logAttivita } from "@/lib/log-attivita";
import type { StatoPresenza } from "@/types";

// Giorni di assenza/smartworking del contatto nel mese indicato.
export async function caricaMieAssenze(
  contattoId: string,
  anno: number,
  mese: number
): Promise<{ data: string; tipo: StatoPresenza }[]> {
  if (!contattoId) return [];
  return data.getAssenzeContattoMese(contattoId, anno, mese);
}

// Imposta lo stato per un giorno (assente/smartworking/nessuno).
export async function impostaMiaPresenza(
  contattoId: string,
  dataIso: string,
  tipo: StatoPresenza | null
): Promise<{ tipo: StatoPresenza | null } | { errore: string }> {
  if (!contattoId) return { errore: "Cerca e seleziona il tuo nominativo dalla rubrica." };
  const risultato = await data.impostaPresenza(contattoId, dataIso, tipo);

  try {
    const contatto = await data.getContatto(contattoId);
    const nome = contatto?.nome ?? contattoId;
    await logAttivita({
      area: "presenza",
      azione: tipo === null ? "rimuovi" : "imposta",
      descrizione:
        tipo === null
          ? `Presenza rimossa: ${nome}, ${dataIso}`
          : `Presenza impostata: ${nome} → ${tipo}, ${dataIso}`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/presenze");
  return { tipo: risultato };
}

// Stato (assente/smartworking) dei contatti in una data (usata dal filtro data del box "È presente?").
export async function caricaAssentiInData(dataIso: string): Promise<{ id: string; tipo: StatoPresenza }[]> {
  return data.getStatoPresenzeInData(dataIso);
}

// Stato (assente/smartworking) dei contatti in un intervallo di date (usata dal
// filtro "per periodo" del box "È presente?" per la tabella persone × giorni).
export async function caricaAssentiInPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<{ id: string; data: string; tipo: StatoPresenza }[]> {
  return data.getStatoPresenzeInPeriodo(dataInizio, dataFine);
}
