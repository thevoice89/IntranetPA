// Calendario eventi: unisce in un'unica lista le due sorgenti che il calendario
// deve mostrare insieme.
//
//  1. gli eventi inseriti dagli utenti nella sezione /calendario cliccando un
//     giorno (tabella eventi_calendario);
//  2. gli eventi già fissati nelle comunicazioni, cioè i campi evento_* compilati
//     nel riquadro "Evento e promemoria in calendario" del back office.
//
// Gli eventi delle comunicazioni NON vengono copiati nella tabella del
// calendario: sono letti dalla comunicazione ad ogni richiesta e convertiti in
// VoceCalendario. Così una comunicazione modificata (o eliminata) aggiorna
// subito il calendario, senza copie da tenere sincronizzate, e nel calendario
// restano in sola lettura — si correggono dalla comunicazione di origine.

import {
  listEventiCalendarioInPeriodo,
  listEventiCalendarioDa,
  getComunicazioniConEventoInPeriodo,
  getComunicazioniConEventoDa,
} from "@/lib/data";
import type { Comunicazione, EventoCalendario, VoceCalendario } from "@/types";

// Primo e ultimo giorno del mese in formato ISO, calcolati sui numeri e non
// costruendo date locali, per non reintrodurre gli sfasamenti di fuso (il
// container gira in UTC). Condivisa dalla pagina e dall'azione che ricarica il
// mese quando si naviga col calendario.
export function estremiMese(anno: number, mese: number): { inizio: string; fine: string } {
  const ultimoGiorno = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  const mm = String(mese).padStart(2, "0");
  return {
    inizio: `${anno}-${mm}-01`,
    fine: `${anno}-${mm}-${String(ultimoGiorno).padStart(2, "0")}`,
  };
}

export function eventoToVoce(e: EventoCalendario): VoceCalendario {
  return {
    id: e.id,
    origine: "calendario",
    titolo: e.titolo,
    data: e.data,
    oraInizio: e.oraInizio,
    oraFine: e.oraFine,
    luogo: e.luogo,
    dettaglio: e.descrizione,
    autore: e.inseritoDa,
    // Sulla prenotazione, non sulla sala: se qualcuno cancella la prenotazione
    // dalla sezione sale (prenotazione_id torna NULL), l'evento resta in quella
    // sala ma smette di dichiararla occupata, che è la verità.
    salaPrenotata: e.prenotazioneId !== null,
    href: null,
  };
}

// La comunicazione arriva sempre da una query che filtra su evento_data non
// nulla, ma il tipo la ammette null: senza data non c'è nulla da mettere in
// calendario, quindi si scarta invece di inventare un giorno.
export function comunicazioneToVoce(c: Comunicazione): VoceCalendario | null {
  if (!c.eventoData) return null;
  return {
    id: c.id,
    origine: "comunicazione",
    titolo: c.titolo,
    data: c.eventoData,
    oraInizio: c.eventoOraInizio,
    oraFine: c.eventoOraFine,
    luogo: c.eventoLuogo ?? "",
    dettaglio: c.estratto,
    autore: c.autore,
    // Gli eventi delle comunicazioni non prenotano sale: il luogo lì è testo
    // libero, e il collegamento sale esiste solo per gli eventi del calendario.
    salaPrenotata: false,
    href: `/comunicazioni/${c.id}`,
  };
}

// Ordinamento condiviso: per giorno, poi per ora di inizio con gli eventi di un
// giorno intero (senza orario) in testa alla giornata, poi per titolo a parità
// di orario, così l'ordine è stabile fra due caricamenti.
export function confrontaVoci(a: VoceCalendario, b: VoceCalendario): number {
  if (a.data !== b.data) return a.data.localeCompare(b.data);
  const oraA = a.oraInizio ?? "";
  const oraB = b.oraInizio ?? "";
  if (oraA !== oraB) return oraA.localeCompare(oraB);
  return a.titolo.localeCompare(b.titolo, "it");
}

// Tutte le voci di un intervallo di giorni (estremi inclusi): il mese
// visualizzato nella griglia di /calendario.
export async function getVociCalendarioInPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<VoceCalendario[]> {
  const [eventi, comunicazioni] = await Promise.all([
    listEventiCalendarioInPeriodo(dataInizio, dataFine),
    getComunicazioniConEventoInPeriodo(dataInizio, dataFine),
  ]);
  return [
    ...eventi.map(eventoToVoce),
    ...comunicazioni.map(comunicazioneToVoce).filter((v): v is VoceCalendario => v !== null),
  ].sort(confrontaVoci);
}

// Vero se la voce è ancora "da venire" rispetto al momento indicato: i giorni
// futuri sempre, oggi solo finché l'evento non è finito. Un evento di oggi senza
// orario (giorno intero) resta valido per tutta la giornata; con orario si guarda
// l'ora di fine, se c'è, altrimenti quella di inizio — così una riunione iniziata
// mezz'ora fa e ancora in corso continua a comparire come prossimo evento invece
// di sparire appena comincia.
function eFutura(v: VoceCalendario, dataOggi: string, oraAdesso: string): boolean {
  if (v.data > dataOggi) return true;
  if (v.data < dataOggi) return false;
  const riferimento = v.oraFine ?? v.oraInizio;
  return riferimento === null || riferimento >= oraAdesso;
}

// Le prossime voci in programma a partire da adesso (giorno + ora italiani
// calcolati dal chiamante, vedi adessoRoma in (site)/page.tsx: il container gira
// in UTC). Si leggono più righe del necessario da entrambe le sorgenti perché il
// filtro sull'orario di oggi avviene qui in memoria: le due query non sanno
// quante righe dell'altra verranno scartate.
export async function getProssimeVociCalendario(
  dataOggi: string,
  oraAdesso: string,
  limit = 5
): Promise<VoceCalendario[]> {
  const [eventi, comunicazioni] = await Promise.all([
    listEventiCalendarioDa(dataOggi, limit + 20),
    getComunicazioniConEventoDa(dataOggi, limit + 20),
  ]);
  return [
    ...eventi.map(eventoToVoce),
    ...comunicazioni.map(comunicazioneToVoce).filter((v): v is VoceCalendario => v !== null),
  ]
    .filter((v) => eFutura(v, dataOggi, oraAdesso))
    .sort(confrontaVoci)
    .slice(0, limit);
}

// Widget "Prossimo evento" in home: la prima voce in programma, o null se non
// c'è nulla in calendario da qui in avanti.
export async function getProssimaVoceCalendario(
  dataOggi: string,
  oraAdesso: string
): Promise<VoceCalendario | null> {
  const voci = await getProssimeVociCalendario(dataOggi, oraAdesso, 1);
  return voci[0] ?? null;
}
