"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getModulo, creaCompilazione } from "@/lib/data";
import type { RispostaInput } from "@/lib/data";
import { saveUpload } from "@/lib/uploads";
import { inviaNotificaModulo } from "@/lib/mail";
import { logAttivita } from "@/lib/log-attivita";

// Limite più stretto di quello globale (next.config.mjs: bodySizeLimit "20mb"),
// perché questa è l'unica azione pubblica non autenticata che accetta file.
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

// Compilazione pubblica di un modulo: nessuna autenticazione richiesta (come
// inviaSegnalazione). Campi/etichette/obbligatorietà vengono sempre letti dal
// modulo salvato sul DB, mai da valori postati dal client.
export async function compilaModulo(formData: FormData) {
  const moduloId = String(formData.get("moduloId") ?? "");
  const modulo = await getModulo(moduloId);
  if (!modulo || !modulo.pubblicato || modulo.tipo !== "form") {
    redirect("/moduli?error=non_disponibile");
  }

  // Prima passata: valida tutti i campi obbligatori prima di toccare il filesystem.
  for (const campo of modulo.campi) {
    if (campo.tipo === "testo_statico") continue; // solo testo, nessuna risposta da validare
    const fieldName = `campo_${campo.id}`;
    if (campo.tipo === "file") {
      const file = formData.get(fieldName);
      const valido = file instanceof File && file.size > 0 ? file : null;
      if (campo.obbligatorio && !valido) {
        redirect(`/moduli/${moduloId}?error=campi_obbligatori`);
      }
      if (valido && valido.size > MAX_FILE_SIZE) {
        redirect(`/moduli/${moduloId}?error=file_troppo_grande`);
      }
    } else if (campo.tipo === "checkbox") {
      if (campo.obbligatorio && formData.get(fieldName) !== "on") {
        redirect(`/moduli/${moduloId}?error=campi_obbligatori`);
      }
    } else if (campo.obbligatorio && !String(formData.get(fieldName) ?? "").trim()) {
      redirect(`/moduli/${moduloId}?error=campi_obbligatori`);
    }
  }

  // Seconda passata: costruisce le risposte, salvando gli allegati su disco
  // solo ora che la validazione è andata a buon fine.
  const risposte: RispostaInput[] = [];
  for (const campo of modulo.campi) {
    if (campo.tipo === "testo_statico") continue; // solo testo, nessuna risposta da registrare
    const fieldName = `campo_${campo.id}`;

    if (campo.tipo === "file") {
      const file = formData.get(fieldName);
      if (file instanceof File && file.size > 0) {
        const { storedName, mime } = await saveUpload(file);
        risposte.push({
          campoId: campo.id,
          etichetta: campo.etichetta,
          tipo: campo.tipo,
          valore: file.name,
          file: { storedName, originalName: file.name, mime },
        });
      } else {
        risposte.push({ campoId: campo.id, etichetta: campo.etichetta, tipo: campo.tipo, valore: "" });
      }
      continue;
    }

    if (campo.tipo === "checkbox") {
      const checked = formData.get(fieldName) === "on";
      risposte.push({
        campoId: campo.id,
        etichetta: campo.etichetta,
        tipo: campo.tipo,
        valore: checked ? "Sì" : "No",
      });
      continue;
    }

    risposte.push({
      campoId: campo.id,
      etichetta: campo.etichetta,
      tipo: campo.tipo,
      valore: String(formData.get(fieldName) ?? "").trim(),
    });
  }

  // Nome/email non sono più campi fissi del form: se l'ufficio vuole
  // raccoglierli, li aggiunge come domande normali (finiscono in "risposte").
  await creaCompilazione(moduloId, risposte);

  // Un problema con l'invio (SMTP non raggiungibile, credenziali errate...)
  // non deve far fallire la compilazione: è già salvata sul DB.
  try {
    await inviaNotificaModulo(modulo);
  } catch (err) {
    console.error(`[mail] invio notifica fallito per il modulo "${modulo.titolo}":`, err);
  }

  try {
    await logAttivita({
      area: "modulo",
      azione: "compila",
      descrizione: `Modulo compilato: "${modulo.titolo}"`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/admin/moduli-ricevuti");
  redirect(`/moduli/${moduloId}?ok=1`);
}
