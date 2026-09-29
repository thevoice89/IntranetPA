"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { getVociCalendarioInPeriodo, estremiMese } from "@/lib/calendario";
import { inviaNotificaPrenotazione } from "@/lib/mail";
import { logAttivita } from "@/lib/log-attivita";
import type { PrenotazioneSala, VoceCalendario } from "@/types";

const PERCORSO = "/calendario";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// Fuso esplicito (stesso metodo di adessoRoma in (site)/page.tsx): il container
// gira in UTC, quindi un "oggi" calcolato senza fuso sarebbe sbagliato di 1-2h
// intorno alla mezzanotte italiana. Serve a rifiutare lato server gli eventi
// creati su date già passate, senza fidarsi del solo controllo nel calendario
// (che l'utente potrebbe aggirare).
function oggiRoma(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

// Fascia in cui la sala risulta occupata quando l'evento non ha orari (evento di
// un giorno intero): sono le stesse ore mostrate dal calendario di Prenotazione
// sale, che non gestisce slot fuori da questo intervallo.
const GIORNATA_INIZIO = "08:00";
const GIORNATA_FINE = "21:00";

// Un'ora dopo "HH:MM", usata quando c'è l'ora di inizio ma non quella di fine:
// una prenotazione ha bisogno di una fine, un evento no. Oltre la mezzanotte si
// ferma alle 23:59 invece di ripartire da 00:xx, che darebbe una prenotazione di
// durata negativa (fine minore dell'inizio) nel controllo di sovrapposizione.
function fineImplicita(oraInizio: string): string {
  const [h, m] = oraInizio.split(":").map(Number);
  const minuti = h * 60 + m + 60;
  if (minuti >= 24 * 60) return "23:59";
  return `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;
}

// Voci (eventi propri + eventi delle comunicazioni) del mese visualizzato:
// chiamata dal calendario quando si cambia mese con le frecce, come
// caricaPrenotazioniSettimana in (site)/prenotazione-sale/actions.ts.
export async function caricaVociMese(anno: number, mese: number): Promise<VoceCalendario[]> {
  if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 1 || mese > 12) return [];
  if (anno < 1970 || anno > 2999) return [];
  const { inizio, fine } = estremiMese(anno, mese);
  return getVociCalendarioInPeriodo(inizio, fine);
}

// Inserimento pubblico di un evento: raggiungibile senza login (stesso principio
// di Prenotazione sale/Segnalazioni), nominativo obbligatorio scelto dalla
// rubrica. Come lì, si accetta solo l'id del contatto e si rilegge il nome da DB
// invece di fidarsi di un nome postato dal client. Gli eventi delle comunicazioni
// non passano da qui: si creano compilando i campi evento della comunicazione.
export async function creaEvento(formData: FormData) {
  const titolo = str(formData, "titolo");
  const dataEvento = str(formData, "data");
  const oraInizio = str(formData, "oraInizio");
  const oraFine = str(formData, "oraFine");
  const luogo = str(formData, "luogo");
  const descrizione = str(formData, "descrizione");
  const contattoId = str(formData, "contattoId");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) redirect(`${PERCORSO}?error=data`);
  if (!titolo) redirect(`${PERCORSO}?error=titolo&giorno=${dataEvento}`);
  if (dataEvento < oggiRoma()) redirect(`${PERCORSO}?error=passato&giorno=${dataEvento}`);
  // Ora di fine senza ora di inizio non ha significato: l'evento è di un giorno
  // intero e la fine viene ignorata, non è un errore da mostrare all'utente.
  const fine = oraInizio ? oraFine : "";
  if (oraInizio && fine && fine <= oraInizio) {
    redirect(`${PERCORSO}?error=orario&giorno=${dataEvento}`);
  }

  const contatto = contattoId ? await data.getContatto(contattoId) : null;
  if (!contatto) redirect(`${PERCORSO}?error=contatto&giorno=${dataEvento}`);

  // Sala comunale (facoltativa): se indicata, l'evento la occupa davvero, cioè
  // genera una prenotazione in Prenotazione sale, così non serve il doppio
  // passaggio. Il contrario non avviene: prenotare una sala da lì non crea un
  // evento in calendario, perché una riunione interna non è per forza un fatto
  // da pubblicizzare.
  const salaId = str(formData, "salaId");
  const sala = salaId ? await data.getSala(salaId) : null;
  if (salaId && !sala) redirect(`${PERCORSO}?error=sala&giorno=${dataEvento}`);
  if (sala?.bloccata) redirect(`${PERCORSO}?error=salabloccata&giorno=${dataEvento}`);

  let prenotazione: PrenotazioneSala | null = null;
  if (sala) {
    // Senza orari l'evento dura tutto il giorno e la sala risulta occupata per
    // l'intera giornata prenotabile; con la sola ora di inizio si assume un'ora.
    const oraPrenInizio = oraInizio || GIORNATA_INIZIO;
    const oraPrenFine = oraInizio ? fine || fineImplicita(oraInizio) : GIORNATA_FINE;
    // Il controllo di sovrapposizione autoritativo (transazione con FOR UPDATE)
    // è dentro creaPrenotazioneSala, che rifiuta anche gli slot inibiti
    // dall'admin. Se la sala non è libera non si crea nulla: meglio un errore
    // subito che un evento in calendario con la sala occupata da altri.
    const esito = await data.creaPrenotazioneSala({
      salaId: sala.id,
      data: dataEvento,
      oraInizio: oraPrenInizio,
      oraFine: oraPrenFine,
      contattoId: contatto.id,
      richiedente: contatto.nome,
      richiedenteEmail: contatto.email,
      // Oggetto della prenotazione: il titolo dell'evento, così chi guarda le
      // prenotazioni capisce a cosa serve la sala.
      note: titolo,
      assistenzaTecnica: false,
      assistenzaTecnicaDettaglio: "",
      assistenzaInformatica: false,
      assistenzaInformaticaDettaglio: "",
    });
    if (!esito.ok) redirect(`${PERCORSO}?error=occupata&giorno=${dataEvento}`);
    prenotazione = {
      id: esito.id,
      salaId: sala.id,
      salaNome: sala.nome,
      data: dataEvento,
      oraInizio: oraPrenInizio,
      oraFine: oraPrenFine,
      contattoId: contatto.id,
      richiedente: contatto.nome,
      richiedenteEmail: contatto.email,
      note: titolo,
      assistenzaTecnica: false,
      assistenzaTecnicaDettaglio: "",
      assistenzaInformatica: false,
      assistenzaInformaticaDettaglio: "",
      creatoIl: new Date().toISOString(),
    };
  }

  try {
    await data.creaEventoCalendario({
      titolo,
      data: dataEvento,
      oraInizio: oraInizio || null,
      oraFine: fine || null,
      // Con una sala scelta il luogo è il suo nome: il campo libero serve per i
      // luoghi che non sono sale comunali.
      luogo: sala ? sala.nome : luogo,
      descrizione,
      contattoId: contatto.id,
      inseritoDa: contatto.nome,
      salaId: sala ? sala.id : null,
      prenotazioneId: prenotazione ? prenotazione.id : null,
    });
  } catch (err) {
    // L'evento non è stato creato: si toglie anche la prenotazione appena fatta,
    // altrimenti la sala resterebbe occupata da un evento che non esiste.
    if (prenotazione) await data.deletePrenotazioneSala(prenotazione.id);
    throw err;
  }

  if (sala && prenotazione) {
    // Stessa notifica di una prenotazione fatta dalla sua sezione: chi gestisce
    // la sala deve sapere che è occupata, da qualunque parte arrivi.
    try {
      await inviaNotificaPrenotazione(sala, prenotazione);
    } catch (err) {
      console.error(`[mail] invio notifica prenotazione fallito (sala "${sala.nome}"):`, err);
    }
  }

  try {
    await logAttivita({
      area: "calendario",
      azione: "crea",
      descrizione: `Evento creato: "${titolo}" il ${dataEvento}${oraInizio ? ` alle ${oraInizio}` : ""} (inserito da ${contatto.nome})${sala ? ` - sala ${sala.nome} prenotata di conseguenza` : ""}`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath(PERCORSO);
  revalidatePath("/");
  if (sala) {
    revalidatePath("/prenotazione-sale");
    revalidatePath("/admin/prenotazioni-sale");
  }
  redirect(`${PERCORSO}?ok=1&giorno=${dataEvento}`);
}

// Eliminazione pubblica di un evento del calendario: senza login non è possibile
// limitarla a chi l'ha inserito, quindi chiunque può eliminare qualunque evento
// (stessa scelta già accettata per le prenotazioni sale). Per compensare, ogni
// eliminazione finisce nel log attività visibile solo all'admin. Gli eventi che
// arrivano dalle comunicazioni non sono eliminabili da qui: nel calendario sono
// in sola lettura e si tolgono svuotando la data evento nella comunicazione.
export async function eliminaEvento(formData: FormData) {
  const id = str(formData, "id");
  if (!id) redirect(`${PERCORSO}?error=dati`);

  const evento = await data.getEventoCalendario(id);
  if (!evento) redirect(`${PERCORSO}?error=dati`);

  await data.deleteEventoCalendario(id);
  // La sala torna libera insieme all'evento che la occupava: la prenotazione era
  // solo una conseguenza dell'evento, non una richiesta a sé.
  if (evento.prenotazioneId) await data.deletePrenotazioneSala(evento.prenotazioneId);

  try {
    await logAttivita({
      area: "calendario",
      azione: "elimina",
      descrizione: `Evento eliminato: "${evento.titolo}" del ${evento.data}${evento.oraInizio ? ` alle ${evento.oraInizio}` : ""} (era stato inserito da ${evento.inseritoDa})${evento.prenotazioneId ? ` - liberata la sala ${evento.salaNome ?? ""}` : ""}`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath(PERCORSO);
  revalidatePath("/");
  if (evento.prenotazioneId) {
    revalidatePath("/prenotazione-sale");
    revalidatePath("/admin/prenotazioni-sale");
  }
  redirect(`${PERCORSO}?eliminato=1&giorno=${evento.data}`);
}
