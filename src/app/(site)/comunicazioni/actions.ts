"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getComunicazione, createCommento, getContatto } from "@/lib/data";
import { logAttivita } from "@/lib/log-attivita";

// Invio pubblico di un commento a una comunicazione (nessuna autenticazione,
// ma il nominativo non è testo libero: va scelto dalla rubrica, come per
// Segnalazioni — vedi inviaSegnalazione in (site)/suggerimenti/actions.ts).
// Ricontrolla sempre commentiAbilitati lato server: il form pubblico lo
// nasconde già, ma non ci si può fidare solo di questo.
export async function inviaCommento(formData: FormData) {
  const comunicazioneId = String(formData.get("comunicazioneId") ?? "").trim();
  const contattoId = String(formData.get("contattoId") ?? "").trim();
  const testo = String(formData.get("testo") ?? "").trim();

  const comunicazione = await getComunicazione(comunicazioneId);
  if (!comunicazione || !comunicazione.commentiAbilitati) redirect("/");

  if (!testo) {
    redirect(`/comunicazioni/${comunicazioneId}?commentoError=testo`);
  }

  // Rilegge il contatto da DB invece di fidarsi di un nome eventualmente postato:
  // l'unico input di provenienza rubrica accettato è un id da risolvere lato server.
  const contatto = contattoId ? await getContatto(contattoId) : null;
  if (!contatto) redirect(`/comunicazioni/${comunicazioneId}?commentoError=contatto`);

  await createCommento(comunicazioneId, contatto.nome, testo);

  try {
    await logAttivita({
      area: "commento",
      azione: "crea",
      descrizione: `Commento di ${contatto.nome} su "${comunicazione.titolo}"`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath(`/comunicazioni/${comunicazioneId}`);
  redirect(`/comunicazioni/${comunicazioneId}?commentoOk=1`);
}
