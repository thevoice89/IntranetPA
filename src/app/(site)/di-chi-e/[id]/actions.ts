"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPacco, getContatto, rivendicaPacco } from "@/lib/data";
import { logAttivita } from "@/lib/log-attivita";
import { inviaNotificaPaccoRivendicato } from "@/lib/mail";

// Dichiarazione pubblica "è mio": raggiungibile senza login dal widget in home.
// Il nominativo, come in inviaSegnalazione, è sempre risolto da un id di
// rubrica riletto qui — mai da nome/email postati direttamente. `id` arriva
// bound dalla pagina (rivendicaPaccoAction.bind(null, pacco.id), pattern
// standard per le server action con parametri extra oltre a FormData) invece
// che da un campo nascosto nel form.
export async function rivendicaPaccoAction(id: string, formData: FormData) {
  const contattoId = String(formData.get("contattoId") ?? "").trim();
  if (!id) redirect("/");

  const pacco = await getPacco(id);
  if (!pacco) redirect("/");

  const contatto = contattoId ? await getContatto(contattoId) : null;
  if (!contatto) redirect(`/di-chi-e/${id}?error=contatto`);

  const assegnato = await rivendicaPacco(id, {
    id: contatto.id,
    nome: contatto.nome,
    email: contatto.email,
  });
  if (!assegnato) redirect(`/di-chi-e/${id}?error=giaAssegnato`);

  try {
    await inviaNotificaPaccoRivendicato(pacco, contatto.nome, contatto.email);
  } catch (err) {
    console.error("[mail] invio notifica pacco rivendicato fallito:", err);
  }

  try {
    await logAttivita({
      area: "pacco",
      azione: "rivendica",
      descrizione: `${contatto.nome} ha dichiarato di essere il destinatario del pacco (${pacco.mittente || "mittente non indicato"})`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/");
  revalidatePath("/admin/pacchi");
  revalidatePath(`/di-chi-e/${id}`);
  redirect(`/di-chi-e/${id}?ok=1`);
}
