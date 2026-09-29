// Fascia oraria prenotabile nel calendario settimanale delle sale (usato sia dal
// wizard pubblico PrenotazioneSaleApp.tsx sia dal blocco-orari admin
// BloccaSlotApp.tsx): di norma 8:00-21:00, ma alcune sale restano prenotabili
// fino a mezzanotte su richiesta esplicita.
const SALE_ORARIO_ESTESO = new Set(["Sala dei Gelsi", "Sala delle Colonne"]);

// Slot di mezz'ora selezionabili in un giorno per la sala indicata, in minuti
// dalla mezzanotte (480=8:00, ..., 1410=23:30 per le sale a orario esteso:
// l'ultimo slot prenotabile arriva fino a mezzanotte).
export function slotGiornoPerSala(nomeSala: string | undefined): number[] {
  const fineMinuti = nomeSala && SALE_ORARIO_ESTESO.has(nomeSala) ? 1440 : 1260;
  const numSlot = (fineMinuti - 480) / 30;
  return Array.from({ length: numSlot }, (_, i) => 480 + i * 30);
}
