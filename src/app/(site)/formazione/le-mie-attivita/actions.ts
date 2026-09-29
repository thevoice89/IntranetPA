"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canVedereFormazioneTutti } from "@/lib/auth";
import * as data from "@/lib/data";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import type { FormazioneAttivita } from "@/types";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// Solo due pagine inviano questo form: quella pubblica (proprio contatto) e
// /admin/formazione (chi ha canVedereFormazioneTutti, per correggere le
// attività di chiunque). Un hidden "redirectTo" nel form dice dove tornare;
// qui si valida contro un elenco chiuso, mai un redirect libero verso un
// valore qualsiasi postato dal client.
const REDIRECT_DEFAULT = "/formazione/le-mie-attivita";
function redirectValido(fd: FormData): string {
  return str(fd, "redirectTo") === "/admin/formazione" ? "/admin/formazione" : REDIRECT_DEFAULT;
}

// Determina il contattoId su cui scrivere e verifica l'autorizzazione:
// - in creazione (nessun id) è sempre il proprio contatto;
// - in modifica/eliminazione di un record esistente, il proprietario oppure
//   chi ha canVedereFormazioneTutti (o admin) — vedi /admin/formazione.
// contattoId non è mai preso dal client: per un record esistente si usa
// sempre quello già salvato, altrimenti chi ha canVedereFormazioneTutti
// potrebbe "rubare" un record spostandolo su un altro contatto.
async function requireAutorizzazioneScrittura(
  esistente: FormazioneAttivita | null,
  redirectTo: string
): Promise<string> {
  const user = await requireUser();
  if (esistente) {
    const proprietario = user.contattoId === esistente.contattoId;
    if (!proprietario && !canVedereFormazioneTutti(user)) {
      redirect(`${redirectTo}?error=permesso`);
    }
    return esistente.contattoId;
  }
  if (!user.contattoId) redirect(`${REDIRECT_DEFAULT}?error=nocontatto`);
  return user.contattoId;
}

export async function salvaAttivitaFormazione(formData: FormData) {
  const redirectTo = redirectValido(formData);
  const id = str(formData, "id") || undefined;
  let esistente: FormazioneAttivita | null = null;
  if (id) {
    esistente = await data.getFormazioneAttivita(id);
    if (!esistente) redirect(`${redirectTo}?error=permesso`);
  }
  const contattoId = await requireAutorizzazioneScrittura(esistente, redirectTo);

  const descrizionePercorso = str(formData, "descrizionePercorso");
  const enteErogatore = str(formData, "enteErogatore");
  const dataCorso = str(formData, "dataCorso");
  const orePrevisteStr = str(formData, "orePreviste");
  const oreSvolteStr = str(formData, "oreSvolte");
  const modalitaFruizione = str(formData, "modalitaFruizione");
  // Tutti obbligatori tranne areaTematica (unico campo facoltativo della
  // scheda). Controllo lato server, autorevole: l'attributo required sui
  // campi del form è solo un aiuto immediato, aggirabile disattivando il JS.
  if (!descrizionePercorso) redirect(`${redirectTo}?error=descrizione`);
  if (!enteErogatore || !dataCorso || !orePrevisteStr || !oreSvolteStr || !modalitaFruizione) {
    redirect(`${redirectTo}?error=campi`);
  }

  const certificazioneCompetenze = formData.get("certificazioneCompetenze") === "on";
  const file = formData.get("attestato");
  const fileCaricato = file instanceof File && file.size > 0;
  // La certificazione delle competenze richiede un attestato: quello appena
  // caricato in questo invio, oppure — in modifica — uno già presente da
  // prima (non lo si deve ricaricare ad ogni salvataggio). Controllo lato
  // server, autorevole: quello nel form (CertificazioneAttestatoField) è solo
  // un aiuto immediato, aggirabile disattivando il JS.
  if (certificazioneCompetenze && !fileCaricato && !esistente?.attestatoUrl) {
    redirect(`${redirectTo}?error=attestato`);
  }

  const nuovoId = await data.upsertFormazioneAttivita({
    id,
    contattoId,
    descrizionePercorso,
    enteErogatore,
    dataCorso,
    orePreviste: Number(orePrevisteStr) || 0,
    oreSvolte: Number(oreSvolteStr) || 0,
    certificazioneCompetenze,
    modalitaFruizione,
    areaTematica: str(formData, "areaTematica"),
  });

  if (fileCaricato && file instanceof File) {
    const { storedName, mime } = await saveUpload(file);
    const vecchio = await data.setAttestatoFormazioneAttivita(nuovoId, {
      fileName: storedName,
      fileNameOriginale: file.name,
      mime,
    });
    if (vecchio) await deleteUpload(vecchio);
  }

  revalidatePath("/formazione/le-mie-attivita");
  revalidatePath("/admin/formazione");
  redirect(redirectTo);
}

export async function rimuoviAttivitaFormazione(formData: FormData) {
  const redirectTo = redirectValido(formData);
  const id = str(formData, "id");
  const esistente = await data.getFormazioneAttivita(id);
  if (!esistente) redirect(`${redirectTo}?error=permesso`);
  await requireAutorizzazioneScrittura(esistente, redirectTo);

  const fileName = await data.deleteFormazioneAttivita(id);
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/formazione/le-mie-attivita");
  revalidatePath("/admin/formazione");
  redirect(redirectTo);
}
