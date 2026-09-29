import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { oggiIso } from "@/lib/format";
import type { TipoComunicazione } from "@/types";

// Modulo normale, NON "use server": ogni export di un file "use server"
// diventa un endpoint richiamabile dal browser, e creaComunicazioneAnnuncio
// non controlla permessi (li verifica il chiamante: saveProcedura, saveGuida,
// saveModulo in admin/actions.ts, salvaAvvisoFormazione in
// (site)/formazione/avvisi/actions.ts).

export function revalidateComunicazioni() {
  revalidatePath("/admin/comunicazioni");
  revalidatePath("/comunicazioni-ufficiali");
  revalidatePath("/comunicazioni-non-ufficiali");
  revalidatePath("/comunicazioni-sicurezza");
  revalidatePath("/comunicazioni-eventi");
  revalidatePath("/comunicazioni-formazione");
  revalidatePath("/");
}

// Crea la comunicazione ufficiale che "pubblicizza" una procedura/modulo/guida
// appena creati (checkbox "Pubblica anche una comunicazione ufficiale" nei
// rispettivi form in saveProcedura/saveGuida/saveModulo): stesso
// meccanismo del collegamento sondaggioId ma con il verso invertito, qui è la
// comunicazione a nascere già agganciata. In evidenza di default: lo scopo è
// farsi notare, non finire silenziosa in fondo all'elenco.
export async function creaComunicazioneAnnuncio(input: {
  userId: string;
  autore: string;
  titolo: string;
  corpo: string;
  categoria: string;
  proceduraId?: string;
  moduloId?: string;
  guidaId?: string;
  tipo?: TipoComunicazione;
}) {
  await data.upsertComunicazione({
    id: `com-${crypto.randomUUID().slice(0, 8)}`,
    tipo: input.tipo ?? "ufficiale",
    titolo: input.titolo,
    estratto: "",
    corpo: input.corpo,
    autore: input.autore,
    data: oggiIso(),
    categoria: input.categoria,
    inEvidenza: true,
    promemoriaData: null,
    evidenzaFine: null,
    eventoData: null,
    eventoOraInizio: null,
    eventoOraFine: null,
    eventoLuogo: null,
    commentiAbilitati: false,
    sondaggioId: null,
    proceduraId: input.proceduraId ?? null,
    moduloId: input.moduloId ?? null,
    guidaId: input.guidaId ?? null,
    creatoDa: input.userId,
    visualizzazioni: 0,
  });
  revalidateComunicazioni();
}
