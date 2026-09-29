"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSegnalazione, getContatto } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { logAttivita } from "@/lib/log-attivita";
import { inviaNotificaSegnalazione } from "@/lib/mail";

// Invio pubblico di una segnalazione: raggiungibile senza login, ma se chi la invia
// risulta comunque loggato (stesso cookie di sessione usato per /admin) la
// segnalazione viene comunque collegata al suo account, solo a scopo informativo in
// /admin/segnalazioni — la risposta arriva sempre via email, come per chiunque altro
// (vedi rispondiSegnalazione in app/admin/actions.ts).
export async function inviaSegnalazione(formData: FormData) {
  const testo = String(formData.get("testo") ?? "").trim();
  const contattoId = String(formData.get("contattoId") ?? "").trim();
  if (!testo) redirect("/suggerimenti?error=testo");

  // Rilegge il contatto da DB invece di fidarsi di nome/email eventualmente postati:
  // l'unico input di provenienza rubrica accettato è un id da risolvere lato server.
  const contatto = contattoId ? await getContatto(contattoId) : null;
  if (!contatto) redirect("/suggerimenti?error=contatto");

  const user = await getCurrentUser();
  await createSegnalazione({
    testo,
    contattoId: contatto.id,
    autore: contatto.nome,
    autoreEmail: contatto.email,
    userId: user?.id ?? null,
  });

  try {
    await inviaNotificaSegnalazione(testo, contatto.nome);
  } catch (err) {
    console.error("[mail] invio notifica nuova segnalazione fallito:", err);
  }

  try {
    await logAttivita({
      area: "segnalazione",
      azione: "crea",
      descrizione: `Segnalazione inviata da ${contatto.nome}`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/admin/segnalazioni");
  redirect("/suggerimenti?ok=1");
}
