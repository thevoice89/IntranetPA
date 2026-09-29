"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSondaggio, creaCompilazioneSondaggio } from "@/lib/data";
import type { RispostaInput } from "@/lib/data";
import { saveUpload } from "@/lib/uploads";
import { logAttivita } from "@/lib/log-attivita";

// Stesso limite di compilaModulo in (site)/moduli/actions.ts: unica azione
// pubblica non autenticata di questa pagina che accetta file.
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

// Compilazione pubblica di un sondaggio: nessuna autenticazione richiesta (come
// compilaModulo/inviaSegnalazione). Campi/etichette/obbligatorietà vengono
// sempre letti dal sondaggio salvato sul DB, mai da valori postati dal client.
export async function compilaSondaggio(formData: FormData) {
  const sondaggioId = String(formData.get("sondaggioId") ?? "");
  const sondaggio = await getSondaggio(sondaggioId);
  if (!sondaggio || !sondaggio.pubblicato) {
    redirect("/sondaggi?error=non_disponibile");
  }

  // Prima passata: valida tutti i campi obbligatori prima di toccare il filesystem.
  for (const campo of sondaggio.campi) {
    if (campo.tipo === "testo_statico") continue;
    const fieldName = `campo_${campo.id}`;
    if (campo.tipo === "file") {
      const file = formData.get(fieldName);
      const valido = file instanceof File && file.size > 0 ? file : null;
      if (campo.obbligatorio && !valido) {
        redirect(`/sondaggi/${sondaggioId}?error=campi_obbligatori`);
      }
      if (valido && valido.size > MAX_FILE_SIZE) {
        redirect(`/sondaggi/${sondaggioId}?error=file_troppo_grande`);
      }
    } else if (campo.tipo === "checkbox") {
      if (campo.obbligatorio && formData.get(fieldName) !== "on") {
        redirect(`/sondaggi/${sondaggioId}?error=campi_obbligatori`);
      }
    } else if (campo.obbligatorio && !String(formData.get(fieldName) ?? "").trim()) {
      redirect(`/sondaggi/${sondaggioId}?error=campi_obbligatori`);
    }
  }

  // Seconda passata: costruisce le risposte, salvando gli allegati su disco
  // solo ora che la validazione è andata a buon fine.
  const risposte: RispostaInput[] = [];
  for (const campo of sondaggio.campi) {
    if (campo.tipo === "testo_statico") continue;
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

  await creaCompilazioneSondaggio(sondaggioId, risposte);

  try {
    await logAttivita({
      area: "sondaggio",
      azione: "compila",
      descrizione: `Sondaggio compilato: "${sondaggio.titolo}"`,
    });
  } catch (err) {
    console.error("[log-attivita] scrittura fallita:", err);
  }

  revalidatePath("/admin/sondaggi-ricevuti");
  redirect(`/sondaggi/${sondaggioId}?ok=1`);
}
