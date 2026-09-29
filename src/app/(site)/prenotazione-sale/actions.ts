"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { inviaNotificaPrenotazione, inviaNotificaAssistenza } from "@/lib/mail";
import { logAttivita } from "@/lib/log-attivita";
import type { PrenotazioneSala, BloccoSala } from "@/types";

// Prenotazioni di una sala per l'intera settimana visualizzata nel calendario
// settimanale (bollini rossi sulle ore occupate di tutti i 7 giorni).
export async function caricaPrenotazioniSettimana(
  salaId: string,
  dataInizio: string,
  dataFine: string
): Promise<PrenotazioneSala[]> {
  if (!salaId || !dataInizio || !dataFine) return [];
  return data.getPrenotazioniSalaInPeriodo(salaId, dataInizio, dataFine);
}

// Blocchi (indisponibilità impostate dall'admin, specifiche della sala o globali)
// che ricadono nella settimana visualizzata: usata per marcare i giorni non
// prenotabili nel calendario settimanale, oltre alle prenotazioni già presenti.
export async function caricaBlocchiSettimana(
  salaId: string,
  dataInizio: string,
  dataFine: string
): Promise<BloccoSala[]> {
  if (!salaId || !dataInizio || !dataFine) return [];
  return data.getBlocchiInPeriodo(salaId, dataInizio, dataFine);
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

// Percorso pubblico da cui è arrivato il form (hidden field "origine" in
// PrenotazioneSaleApp.tsx): il wizard è condiviso tra /prenotazione-sale e
// /prenotazione-sale/matrimoni, quindi i redirect dopo submit devono tornare
// alla pagina di partenza invece che sempre a quella principale. Qualunque
// valore non riconosciuto ricade sulla pagina principale.
const PERCORSO_DEFAULT = "/prenotazione-sale";
const PERCORSI_VALIDI = new Set([PERCORSO_DEFAULT, "/prenotazione-sale/matrimoni"]);

function percorsoOrigine(fd: FormData): string {
  const origine = str(fd, "origine");
  return PERCORSI_VALIDI.has(origine) ? origine : PERCORSO_DEFAULT;
}

// Fuso esplicito (stesso metodo di adessoRoma in (site)/page.tsx): il container
// gira in UTC, quindi confrontare le date scelte con un "oggi" calcolato senza
// fuso sarebbe sbagliato di 1-2h intorno alla mezzanotte italiana — qui serve
// per bloccare lato server le prenotazioni su date già passate, non fidandosi
// del solo controllo lato client (che l'utente potrebbe aggirare).
function oggiRoma(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

// Mezz'ora dopo "HH:MM" (gli slot arrivano sempre in punta d'ora o mezza dal
// calendario settimanale, vedi PrenotazioneSaleApp.tsx: un click = uno slot di
// mezz'ora).
function oraSuccessiva(ora: string): string {
  const [h, m] = ora.split(":").map(Number);
  const totaleMinuti = h * 60 + m + 30;
  const hh = Math.floor(totaleMinuti / 60);
  const mm = totaleMinuti % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface FasciaOraria {
  data: string;
  oraInizio: string;
  oraFine: string;
}

// Unisce gli slot di mezz'ora scelti col calendario settimanale in fasce orarie
// consecutive: cliccare le 9:00-9:30-10:00-10:30-11:00 dello stesso giorno deve
// produrre UNA sola prenotazione 9:00-11:30, non 5 righe separate. Slot non
// contigui (o di giorni diversi) restano fasce distinte — cliccare le 11:00 e le
// 17:00 resta 11:00-11:30 e 17:00-17:30.
function raggruppaSlotConsecutivi(
  slotGrezzi: string[]
): FasciaOraria[] {
  const slot = slotGrezzi
    .map((grezzo) => {
      const [dataIso, oraInizio] = grezzo.split("|");
      return dataIso && oraInizio ? { data: dataIso, ora: oraInizio } : null;
    })
    .filter((s): s is { data: string; ora: string } => s !== null)
    .sort((a, b) => (a.data === b.data ? a.ora.localeCompare(b.ora) : a.data.localeCompare(b.data)));

  const fasce: FasciaOraria[] = [];
  for (const s of slot) {
    const ultima = fasce[fasce.length - 1];
    if (ultima && ultima.data === s.data && ultima.oraFine === s.ora) {
      ultima.oraFine = oraSuccessiva(s.ora);
    } else {
      fasce.push({ data: s.data, oraInizio: s.ora, oraFine: oraSuccessiva(s.ora) });
    }
  }
  return fasce;
}

// Invio pubblico di una o più prenotazioni indipendenti: raggiungibile senza login
// (stesso principio di Segnalazioni/Sondaggi), nominativo obbligatorio scelto dalla
// rubrica. Ogni "slot" (formato "YYYY-MM-DD|HH:MM") è uno slot di mezz'ora scelto
// col calendario settimanale; slot consecutivi dello stesso giorno vengono uniti in
// un'unica fascia da raggruppaSlotConsecutivi prima dell'inserimento (una sola
// prenotazione 9:00-11:30 per 5 click consecutivi, non 5 prenotazioni separate). Rilegge
// sala e contatto da DB invece di fidarsi di eventuali nome/email postati: l'unico
// input di provenienza rubrica accettato è un id da risolvere lato server. Il
// controllo di sovrapposizione autoritativo è in data.creaPrenotazioneSala
// (transazione con FOR UPDATE) per ciascuna fascia indipendentemente: una fascia in
// conflitto (es. prenotata da un altro nel frattempo) non blocca la creazione delle
// altre.
export async function creaPrenotazioni(formData: FormData) {
  const percorso = percorsoOrigine(formData);
  const salaId = str(formData, "salaId");
  const slotGrezzi = formData.getAll("slot").map(String).filter(Boolean);
  const contattoId = str(formData, "contattoId");
  // Nominativo esterno inserito a mano (non in rubrica), alternativo a
  // contattoId: vedi il toggle "Chi prenota non è in rubrica" in
  // PrenotazioneSaleApp.tsx. Se presente ha priorità sul contattoId (che in quel
  // caso arriva comunque vuoto dal form).
  const nominativoEsterno = str(formData, "nominativoEsterno");
  const contattoEsterno = str(formData, "contattoEsterno");
  const note = str(formData, "note");
  const assistenzaTecnica = bool(formData, "assistenzaTecnica");
  const assistenzaInformatica = bool(formData, "assistenzaInformatica");
  // Il dettaglio conta solo se il flag corrispondente è attivo: la textarea resta
  // nel form anche a checkbox deselezionato (nascosta via CSS in
  // PrenotazioneSaleApp.tsx), quindi non ci si fida del solo valore postato.
  const assistenzaTecnicaDettaglio = assistenzaTecnica ? str(formData, "assistenzaTecnicaDettaglio") : "";
  const assistenzaInformaticaDettaglio = assistenzaInformatica
    ? str(formData, "assistenzaInformaticaDettaglio")
    : "";

  if (!salaId || slotGrezzi.length === 0) redirect(`${percorso}?error=dati`);
  if (!note) redirect(`${percorso}?error=oggetto`);

  const sala = await data.getSala(salaId);
  if (!sala) redirect(`${percorso}?error=sala`);
  if (sala.bloccata) redirect(`${percorso}?error=salabloccata`);

  // Risolve chi prenota: dalla rubrica (id rivalidato lato server, come sempre)
  // oppure, se il toggle "esterno" era attivo, dal nominativo inserito a mano —
  // in quel caso non esiste un contatto_id, solo lo snapshot richiedente/email.
  let richiedenteContattoId: string | null;
  let richiedenteNome: string;
  let richiedenteEmail: string;
  if (nominativoEsterno) {
    richiedenteContattoId = null;
    richiedenteNome = nominativoEsterno;
    richiedenteEmail = contattoEsterno;
  } else {
    const contatto = contattoId ? await data.getContatto(contattoId) : null;
    if (!contatto) redirect(`${percorso}?error=contatto`);
    richiedenteContattoId = contatto.id;
    richiedenteNome = contatto.nome;
    richiedenteEmail = contatto.email;
  }

  const fasce = raggruppaSlotConsecutivi(slotGrezzi);
  if (fasce.some((f) => f.data < oggiRoma())) redirect(`${percorso}?error=passato`);

  let creati = 0;
  let conflitti = 0;
  for (const fascia of fasce) {
    const esito = await data.creaPrenotazioneSala({
      salaId,
      data: fascia.data,
      oraInizio: fascia.oraInizio,
      oraFine: fascia.oraFine,
      contattoId: richiedenteContattoId,
      richiedente: richiedenteNome,
      richiedenteEmail,
      note,
      assistenzaTecnica,
      assistenzaTecnicaDettaglio,
      assistenzaInformatica,
      assistenzaInformaticaDettaglio,
    });
    if (!esito.ok) {
      conflitti++;
      continue;
    }
    creati++;

    const prenotazioneCreata: PrenotazioneSala = {
      id: esito.id,
      salaId,
      salaNome: sala.nome,
      data: fascia.data,
      oraInizio: fascia.oraInizio,
      oraFine: fascia.oraFine,
      contattoId: richiedenteContattoId,
      richiedente: richiedenteNome,
      richiedenteEmail,
      note,
      assistenzaTecnica,
      assistenzaTecnicaDettaglio,
      assistenzaInformatica,
      assistenzaInformaticaDettaglio,
      creatoIl: new Date().toISOString(),
    };

    try {
      await inviaNotificaPrenotazione(sala, prenotazioneCreata);
    } catch (err) {
      console.error(`[mail] invio notifica prenotazione fallito (sala "${sala.nome}"):`, err);
    }

    if (assistenzaTecnica) {
      try {
        await inviaNotificaAssistenza("tecnica", prenotazioneCreata);
      } catch (err) {
        console.error("[mail] invio notifica assistenza tecnica fallito:", err);
      }
    }

    if (assistenzaInformatica) {
      try {
        await inviaNotificaAssistenza("informatica", prenotazioneCreata);
      } catch (err) {
        console.error("[mail] invio notifica assistenza informatica fallito:", err);
      }
    }

    try {
      await logAttivita({
        area: "prenotazione_sala",
        azione: "crea",
        descrizione: `Prenotazione creata: ${sala.nome}, ${fascia.data} ${fascia.oraInizio}-${fascia.oraFine} (richiesta da ${richiedenteNome})`,
      });
    } catch (err) {
      console.error("[log-attivita] scrittura fallita:", err);
    }
  }

  revalidatePath("/admin/prenotazioni-sale");
  revalidatePath("/prenotazione-sale");
  revalidatePath("/prenotazione-sale/matrimoni");
  if (creati === 0) redirect(`${percorso}?error=conflitto`);
  if (conflitti > 0) redirect(`${percorso}?ok=1&conflitti=${conflitti}`);
  redirect(`${percorso}?ok=1`);
}

// Eliminazione pubblica di una prenotazione: raggiungibile senza login, come la
// creazione — non essendoci autenticazione non è possibile limitare la cancellazione
// a chi l'ha creata, quindi chiunque può eliminare qualunque prenotazione (stesso
// principio di "modificare tutto" già accettato per Segnalazioni/Sondaggi). Per
// compensare, ogni eliminazione finisce nel log attività (vedi lib/log-attivita.ts),
// visibile solo all'admin in /admin/log-attivita.
export async function eliminaPrenotazione(formData: FormData) {
  const percorso = percorsoOrigine(formData);
  const id = str(formData, "id");
  if (!id) redirect(`${percorso}?error=dati`);

  const prenotazione = await data.getPrenotazioneSala(id);
  if (!prenotazione) redirect(`${percorso}?error=dati`);

  await data.deletePrenotazioneSala(id);

  try {
    await logAttivita({
      area: "prenotazione_sala",
      azione: "elimina",
      descrizione: `Prenotazione eliminata: ${prenotazione.salaNome}, ${prenotazione.data} ${prenotazione.oraInizio}-${prenotazione.oraFine} (era stata richiesta da ${prenotazione.richiedente})`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/admin/prenotazioni-sale");
  revalidatePath("/prenotazione-sale");
  revalidatePath("/prenotazione-sale/matrimoni");
  redirect(`${percorso}?eliminata=1`);
}
