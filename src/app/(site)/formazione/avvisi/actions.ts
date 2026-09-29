"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canEditFormazioneAvviso, canEdit } from "@/lib/auth";
import * as data from "@/lib/data";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import { creaComunicazioneAnnuncio } from "@/lib/comunicazione-annuncio";
import type { FormazioneAvviso, User } from "@/types";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

// Nome mostrato come autore dell'avviso: dalla rubrica se l'account è
// collegato (stesso principio di autore nelle comunicazioni), altrimenti lo
// username — mai chiesto nel form, che resta volutamente ridotto a
// titolo/descrizione/allegati.
async function risolviAutore(user: User): Promise<string> {
  if (user.contattoId) {
    const contatto = await data.getContatto(user.contattoId);
    if (contatto) return contatto.nome;
  }
  return user.username;
}

export async function salvaAvvisoFormazione(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id") || undefined;

  let esistente: FormazioneAvviso | null = null;
  if (id) {
    esistente = await data.getFormazioneAvviso(id);
    if (!esistente || !canEditFormazioneAvviso(user, esistente)) {
      redirect("/formazione/avvisi?error=permesso");
    }
  }

  const titolo = str(formData, "titolo");
  if (!titolo) redirect("/formazione/avvisi/nuovo?error=titolo");
  const descrizione = str(formData, "descrizione");
  if (!descrizione) redirect("/formazione/avvisi/nuovo?error=descrizione");

  const isNew = !id;
  const pubblicaNotizia = isNew && bool(formData, "pubblicaNotiziaFormazione") && canEdit(user, "formazione");
  const autoreContatto = pubblicaNotizia
    ? await data.getContatto(str(formData, "notiziaFormazioneAutoreContattoId"))
    : null;
  if (pubblicaNotizia && !autoreContatto) redirect("/formazione/avvisi/nuovo?error=autoreFormazione");

  const nuovoId = await data.upsertFormazioneAvviso({
    id,
    titolo,
    descrizione,
    autore: esistente?.autore ?? (await risolviAutore(user)),
    creatoDa: esistente?.creatoDa ?? user.id,
  });

  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const { storedName, mime } = await saveUpload(file);
    await data.addAllegatoAvvisoFile(nuovoId, file.name, storedName, mime);
  }

  const link = str(formData, "link");
  if (link) {
    await data.addAllegatoAvvisoLink(nuovoId, str(formData, "linkEtichetta") || link, link);
  }

  if (autoreContatto) {
    await creaComunicazioneAnnuncio({
      userId: user.id,
      autore: autoreContatto.nome,
      titolo: `Nuovo avviso di formazione: ${titolo}`,
      corpo: str(formData, "notiziaFormazioneTesto") || `È disponibile un nuovo avviso in Formazione: «${titolo}». Consultalo nella bacheca avvisi.`,
      categoria: "Generale",
      tipo: "formazione",
    });
  }

  revalidatePath("/formazione/avvisi");
  redirect("/formazione/avvisi");
}

export async function rimuoviAllegatoAvviso(formData: FormData) {
  const user = await requireUser();
  const avvisoId = str(formData, "avvisoId");
  const esistente = await data.getFormazioneAvviso(avvisoId);
  if (!esistente || !canEditFormazioneAvviso(user, esistente)) {
    redirect("/formazione/avvisi?error=permesso");
  }
  const fileName = await data.deleteAllegatoAvviso(str(formData, "id"), esistente.id);
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/formazione/avvisi");
  redirect(`/formazione/avvisi/nuovo?edit=${avvisoId}`);
}

export async function rimuoviAvvisoFormazione(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const esistente = await data.getFormazioneAvviso(id);
  if (!esistente || !canEditFormazioneAvviso(user, esistente)) {
    redirect("/formazione/avvisi?error=permesso");
  }
  const fileNames = await data.deleteFormazioneAvviso(id);
  for (const fileName of fileNames) await deleteUpload(fileName);
  revalidatePath("/formazione/avvisi");
  redirect("/formazione/avvisi");
}
