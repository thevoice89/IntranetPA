"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { getContatto, upsertComunicazione, addAllegatoFile } from "@/lib/data";
import { saveUpload } from "@/lib/uploads";
import { logAttivita } from "@/lib/log-attivita";
import { oggiIso } from "@/lib/format";
import type { Comunicazione } from "@/types";

// Pubblicazione pubblica di una comunicazione "non ufficiale": raggiungibile senza
// login (bacheca aperta a tutti i colleghi), ma il nominativo è sempre risolto da un
// contatto reale della rubrica (mai testo libero), stesso principio di
// inviaSegnalazione in (site)/suggerimenti/actions.ts. Nessuna moderazione preventiva:
// stessa fiducia già accordata ai commenti pubblici ("visibili subito"). Resta comunque
// modificabile/eliminabile dall'admin come le comunicazioni create dal pannello.
// Categoria fissa a "Generale": le non ufficiali sono bacheca informale aperta a
// tutti, non organizzata per ufficio come le ufficiali.
export async function pubblicaComunicazione(formData: FormData) {
  const titolo = String(formData.get("titolo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const contattoId = String(formData.get("contattoId") ?? "").trim();

  if (!titolo) redirect("/comunicazioni-non-ufficiali/nuova?error=titolo");
  if (!corpo) redirect("/comunicazioni-non-ufficiali/nuova?error=corpo");

  // Rilegge il contatto da DB invece di fidarsi di nome/email eventualmente postati:
  // l'unico input di provenienza rubrica accettato è un id da risolvere lato server.
  const contatto = contattoId ? await getContatto(contattoId) : null;
  if (!contatto) redirect("/comunicazioni-non-ufficiali/nuova?error=contatto");

  const estratto = corpo.length > 160 ? `${corpo.slice(0, 160).trimEnd()}…` : corpo;

  const comunicazione: Comunicazione = {
    id: `com-${crypto.randomUUID().slice(0, 8)}`,
    tipo: "non_ufficiale",
    titolo,
    estratto,
    corpo,
    autore: contatto.nome,
    data: oggiIso(),
    categoria: "Generale",
    inEvidenza: false,
    promemoriaData: null,
    evidenzaFine: null,
    // L'evento collegato si imposta solo dal back office: la bacheca informale
    // resta un form minimo (titolo + corpo + nominativo + allegato facoltativo).
    eventoData: null,
    eventoOraInizio: null,
    eventoOraFine: null,
    eventoLuogo: null,
    // Bacheca informale: sempre commentabile, come le comunicazioni RSU (vedi
    // admin/actions.ts saveComunicazione per l'analoga forzatura sul tipo rsu).
    commentiAbilitati: true,
    sondaggioId: null,
    proceduraId: null,
    moduloId: null,
    guidaId: null,
    // Pubblicata senza login: nessun account editor da registrare come
    // proprietario, resta gestibile solo dall'admin (vedi
    // canEditComunicazioneItem in lib/auth.ts).
    creatoDa: null,
    visualizzazioni: 0,
  };
  await upsertComunicazione(comunicazione);

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const { storedName, mime } = await saveUpload(file);
    await addAllegatoFile(comunicazione.id, file.name, storedName, mime);
  }

  try {
    await logAttivita({
      area: "comunicazione",
      azione: "crea",
      descrizione: `Comunicazione non ufficiale pubblicata: "${titolo}" (${contatto.nome})`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/comunicazioni-non-ufficiali");
  revalidatePath("/admin/comunicazioni");
  revalidatePath("/");
  redirect(`/comunicazioni/${comunicazione.id}?pubblicato=1`);
}
