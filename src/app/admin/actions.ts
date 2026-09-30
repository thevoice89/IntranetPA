"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import {
  createSession,
  destroySession,
  getCurrentUser,
  requireUser,
  requireAdmin,
  canEdit,
  canEditAny,
  canEditComunicazioneItem,
  canManageUfficio,
  canManageModuloItem,
  canManageSondaggi,
  canManageSondaggioItem,
  canEditRubrica,
  canEditRegolamenti,
  canEditProcedure,
  canEditGuide,
  canEditCartaIntestata,
  canManageSegnalazioni,
  canManagePacchi,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { percorsoInterno } from "@/lib/ritorno-login";
import { ipRichiesta } from "@/lib/log-attivita";
import { loginBloccato, registraLoginFallito, registraLoginRiuscito } from "@/lib/limite-login";
import { creaComunicazioneAnnuncio, revalidateComunicazioni } from "@/lib/comunicazione-annuncio";
import { oggiIso } from "@/lib/format";
import { sanitizeRicco } from "@/lib/rich-text";
import * as data from "@/lib/data";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import {
  CHIAVI_BRANDING,
  IMMAGINI_ENTE,
  coordinataValida,
  eTipoImmagineEnte,
  emailValida,
  urlHttpValido,
  verificaPng,
} from "@/lib/branding";
import { extractPdfText } from "@/lib/pdf-text";
import { inviaRispostaSegnalazione, inviaEmailProva } from "@/lib/mail";
import {
  TIPI_CAMPO_MODULO,
  type Servizio,
  type StatoServizio,
  type Portale,
  type StatoPortale,
  type Comunicazione,
  type TipoComunicazione,
  type CategoriaComunicazione,
  type TipoGuida,
  type Ruolo,
  type TipoCampoModulo,
  type LivelloUfficio,
  type MenuId,
} from "@/types";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

const TIPI_CAMPO_VALIDI = new Set<string>(TIPI_CAMPO_MODULO.map((t) => t.value));

// La gerarchia uffici alimenta il picker/i filtri in tutte queste pagine:
// una modifica (nome, genitore, aggiunta, eliminazione) le rende tutte stale.
function revalidateUffici() {
  revalidatePath("/admin/uffici");
  revalidatePath("/admin/moduli");
  revalidatePath("/admin/rubrica");
  revalidatePath("/admin/procedure");
  revalidatePath("/admin/utenti");
  revalidatePath("/moduli");
  revalidatePath("/procedure");
  revalidatePath("/rubrica");
}

// ===================== AUTH ============================================
export async function loginAction(formData: FormData) {
  const username = str(formData, "username");
  const password = str(formData, "password");
  // Pagina da cui si arriva (campo nascosto della pagina di login, vedi
  // lib/ritorno-login.ts): senza, si apre la dashboard come prima.
  const next = percorsoInterno(str(formData, "next"));
  const conErrore = (errore: string) =>
    next ? `/admin/login?error=${errore}&next=${encodeURIComponent(next)}` : `/admin/login?error=${errore}`;

  // Controllato prima di verificare la password: da bloccati non si deve
  // poter capire se un tentativo sarebbe andato a buon fine.
  const ip = await ipRichiesta();
  if (loginBloccato(ip, username)) redirect(conErrore("troppi"));

  const u = await data.getUserAuthByUsername(username);
  if (!u || !verifyPassword(password, u.salt, u.hash)) {
    registraLoginFallito(ip, username);
    redirect(conErrore("1"));
  }
  registraLoginRiuscito(ip, username);
  await createSession(u.id, u.sessioneVersione);
  redirect(next ?? "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

// ===================== SERVIZI (solo admin) ===========================
export async function saveServizio(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id") || `srv-${crypto.randomUUID().slice(0, 8)}`;
  const servizio: Servizio = {
    id,
    nome: str(formData, "nome"),
    descrizione: str(formData, "descrizione"),
    url: str(formData, "url"),
    icona: str(formData, "icona") || "🔗",
    categoria: str(formData, "categoria"),
    stato: (str(formData, "stato") as StatoServizio) || "attivo",
  };
  await data.upsertServizio(servizio);
  revalidatePath("/admin/servizi");
  revalidatePath("/dashboard-servizi");
  redirect("/admin/servizi");
}

export async function removeServizio(formData: FormData) {
  await requireAdmin();
  await data.deleteServizio(str(formData, "id"));
  revalidatePath("/admin/servizi");
  revalidatePath("/dashboard-servizi");
  redirect("/admin/servizi");
}

// Riordino via drag&drop: niente redirect, la pagina aggiorna lo stato in locale.
export async function reorderServizi(ids: string[]) {
  await requireAdmin();
  await data.reorderServizi(ids);
  revalidatePath("/admin/servizi");
  revalidatePath("/dashboard-servizi");
}

// ===================== PORTALI (solo admin) ============================
export async function savePortale(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id") || `prt-${crypto.randomUUID().slice(0, 8)}`;
  const portale: Portale = {
    id,
    nome: str(formData, "nome"),
    descrizione: str(formData, "descrizione"),
    url: str(formData, "url"),
    icona: str(formData, "icona") || "🔗",
    categoria: str(formData, "categoria"),
    stato: (str(formData, "stato") as StatoPortale) || "attivo",
  };
  await data.upsertPortale(portale);
  revalidatePath("/admin/portali");
  revalidatePath("/dashboard-portali");
  redirect("/admin/portali");
}

export async function removePortale(formData: FormData) {
  await requireAdmin();
  await data.deletePortale(str(formData, "id"));
  revalidatePath("/admin/portali");
  revalidatePath("/dashboard-portali");
  redirect("/admin/portali");
}

// Riordino via drag&drop: niente redirect, la pagina aggiorna lo stato in locale.
export async function reorderPortali(ids: string[]) {
  await requireAdmin();
  await data.reorderPortali(ids);
  revalidatePath("/admin/portali");
  revalidatePath("/dashboard-portali");
}

// ===================== COMUNICAZIONI ==================================
export async function saveComunicazione(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const tipo = (str(formData, "tipo") as TipoComunicazione) || "ufficiale";

  // Permesso sul tipo scelto.
  if (!canEdit(user, tipo)) redirect("/admin/comunicazioni");
  // In modifica: permesso anche sul tipo originale, e solo sulla propria
  // comunicazione (un editor non-admin non può modificare quelle altrui).
  const esistente = id ? await data.getComunicazione(id) : null;
  if (id && (!esistente || !canEditComunicazioneItem(user, esistente))) {
    redirect("/admin/comunicazioni");
  }

  // Per ufficiali, RSU, Sicurezza sul lavoro ed Eventi l'autore non è testo
  // libero: va risolto da un contatto reale della rubrica (stesso principio
  // del form pubblico delle non ufficiali, vedi (site)/comunicazioni-non-ufficiali/actions.ts),
  // mai fidandosi di un eventuale campo "autore" testuale postato a parte.
  let autore = str(formData, "autore");
  if (
    tipo === "rsu" ||
    tipo === "ufficiale" ||
    tipo === "sicurezza" ||
    tipo === "eventi"
  ) {
    const contattoId = str(formData, "autoreContattoId");
    const contatto = contattoId ? await data.getContatto(contattoId) : null;
    if (!contatto) redirect("/admin/comunicazioni?error=autore");
    autore = contatto.nome;
  }

  // Data dell'evento collegato: comanda anche orari e luogo, che senza di essa
  // non hanno significato (vedi sotto). È anche ciò che fa comparire la
  // comunicazione nel Calendario del sito (vedi lib/calendario.ts).
  const eventoData = str(formData, "eventoData");

  const comunicazione: Comunicazione = {
    id: id || `com-${crypto.randomUUID().slice(0, 8)}`,
    tipo,
    titolo: str(formData, "titolo"),
    estratto: str(formData, "estratto"),
    // Il corpo arriva dall'editor ricco (HTML): whitelist di tag e attributi
    // in lib/rich-text.ts, qui è l'unico punto in cui viene scritto dal
    // pannello. I corpi storici in testo semplice restano validi, se ne occupa
    // corpoComunicazioneHtml al momento di mostrarli.
    corpo: sanitizeRicco(str(formData, "corpo")),
    autore,
    data: str(formData, "data") || oggiIso(),
    categoria: (str(formData, "categoria") as CategoriaComunicazione) || "Generale",
    inEvidenza: bool(formData, "inEvidenza"),
    promemoriaData: str(formData, "promemoriaData") || null,
    evidenzaFine: str(formData, "evidenzaFine") || null,
    eventoData: eventoData || null,
    // Orari e luogo hanno senso solo con una data evento: senza, si scartano per
    // non lasciare in DB un "ore 15:00" appeso a nessun giorno.
    eventoOraInizio: eventoData ? str(formData, "eventoOraInizio") || null : null,
    eventoOraFine: eventoData ? str(formData, "eventoOraFine") || null : null,
    eventoLuogo: eventoData ? str(formData, "eventoLuogo") || null : null,
    // Le comunicazioni RSU sono sempre commentabili, indipendentemente dalla spunta.
    commentiAbilitati: tipo === "rsu" ? true : bool(formData, "commentiAbilitati"),
    sondaggioId: str(formData, "sondaggioId") || null,
    // Collegamento a procedura/modulo/guida: impostato solo alla creazione
    // automatica dai rispettivi form ("Pubblica anche una comunicazione
    // ufficiale"), mai da questo form — in modifica il valore originale non
    // cambia (upsertComunicazione lo preserva comunque, questi servono solo a
    // passare il typecheck).
    proceduraId: esistente ? esistente.proceduraId : null,
    moduloId: esistente ? esistente.moduloId : null,
    guidaId: esistente ? esistente.guidaId : null,
    // In creazione: proprietario = chi la crea da pannello. In modifica: il
    // proprietario originale non cambia (upsertComunicazione lo preserva
    // comunque, questo valore serve solo a passare il typecheck).
    creatoDa: esistente ? esistente.creatoDa : user.id,
    // Il contatore visualizzazioni non viene mai scritto da upsertComunicazione
    // (si aggiorna solo con incrementaVisualizzazioni ad ogni apertura pubblica):
    // qui serve solo a passare il typecheck.
    visualizzazioni: esistente ? esistente.visualizzazioni : 0,
  };
  await data.upsertComunicazione(comunicazione);

  // Allegato e link compilati direttamente nel form di creazione: si agganciano
  // qui, subito dopo l'inserimento, perché prima non esiste un id di
  // comunicazione a cui legarli — è il motivo per cui in creazione non si può
  // usare il riquadro allegati vero e proprio (uploadAllegatoFile /
  // addAllegatoLink lavorano su una comunicazione già esistente). In modifica
  // questi campi non vengono mostrati e restano vuoti: lì si usano i riquadri
  // dedicati, che aggiungono e rimuovono senza passare da un salvataggio.
  const nuovoFile = formData.get("nuovoFile");
  if (nuovoFile instanceof File && nuovoFile.size > 0) {
    const { storedName, mime } = await saveUpload(nuovoFile);
    const etichetta = str(formData, "nuovoFileEtichetta") || nuovoFile.name;
    await data.addAllegatoFile(comunicazione.id, etichetta, storedName, mime);
  }
  const nuovoLink = str(formData, "nuovoLink");
  if (nuovoLink) {
    // Etichetta vuota: addAllegatoLink ricade sull'URL stesso.
    await data.addAllegatoLink(comunicazione.id, str(formData, "nuovoLinkEtichetta"), nuovoLink);
  }

  revalidateComunicazioni();
  // Resta sulla pagina di modifica per poter aggiungere altri allegati.
  redirect(`/admin/comunicazioni?edit=${comunicazione.id}`);
}

export async function removeComunicazione(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const esistente = await data.getComunicazione(id);
  if (!esistente || !canEditComunicazioneItem(user, esistente)) {
    redirect("/admin/comunicazioni");
  }
  const fileNames = await data.deleteComunicazione(id);
  await Promise.all(fileNames.map((f) => deleteUpload(f)));
  revalidateComunicazioni();
  redirect("/admin/comunicazioni");
}

// ===================== COMMENTI COMUNICAZIONI =========================
export async function removeCommento(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const commento = await data.getCommento(id);
  if (!commento || !canEdit(user, commento.comunicazioneTipo)) {
    redirect("/admin/commenti");
  }
  await data.deleteCommento(id);
  revalidatePath("/admin/commenti");
  revalidatePath(`/comunicazioni/${commento.comunicazioneId}`);
  redirect("/admin/commenti");
}

export async function markCommento(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const commento = await data.getCommento(id);
  if (!commento || !canEdit(user, commento.comunicazioneTipo)) {
    redirect("/admin/commenti");
  }
  await data.markCommentoLetto(id, str(formData, "letta") === "true");
  revalidatePath("/admin/commenti");
  redirect("/admin/commenti");
}

// ===================== ALLEGATI =======================================
// Permesso sul tipo + proprietà, come saveComunicazione/removeComunicazione: un
// editor non-admin tocca gli allegati solo delle proprie comunicazioni (la
// pagina admin mostra il riquadro allegati solo a loro, vedi inModifica).
async function assertCanEditComunicazione(comunicazioneId: string) {
  const user = await requireUser();
  const com = await data.getComunicazione(comunicazioneId);
  if (!com || !canEditComunicazioneItem(user, com)) redirect("/admin/comunicazioni");
}

export async function addAllegatoLink(formData: FormData) {
  const comId = str(formData, "comunicazioneId");
  await assertCanEditComunicazione(comId);
  const url = str(formData, "url");
  if (url) {
    await data.addAllegatoLink(comId, str(formData, "etichetta"), url);
    revalidateComunicazioni();
  }
  redirect(`/admin/comunicazioni?edit=${comId}`);
}

export async function uploadAllegatoFile(formData: FormData) {
  const comId = str(formData, "comunicazioneId");
  await assertCanEditComunicazione(comId);
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const { storedName, mime } = await saveUpload(file);
    const etichetta = str(formData, "etichetta") || file.name;
    await data.addAllegatoFile(comId, etichetta, storedName, mime);
    revalidateComunicazioni();
  }
  redirect(`/admin/comunicazioni?edit=${comId}`);
}

export async function removeAllegato(formData: FormData) {
  const comId = str(formData, "comunicazioneId");
  await assertCanEditComunicazione(comId);
  const fileName = await data.deleteAllegato(str(formData, "id"), comId);
  if (fileName) await deleteUpload(fileName);
  revalidateComunicazioni();
  redirect(`/admin/comunicazioni?edit=${comId}`);
}

// ===================== IMMAGINI NEL TESTO =============================
const IMMAGINE_MIME_AMMESSI = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const IMMAGINE_MAX_BYTE = 5 * 1024 * 1024;

// Carica l'immagine che l'editor ricco inserisce nel corpo e restituisce l'URL
// da scrivere nell'HTML. È chiamata direttamente dal client (RichTextEditor),
// non da un <form>: per questo restituisce l'errore invece di fare redirect,
// e usa getCurrentUser invece di requireUser (che redirige).
//
// Niente SVG fra i formati ammessi: è un documento XML che può contenere
// script, e nessuno ha bisogno di un logo vettoriale dentro una comunicazione.
export async function caricaImmagineTesto(
  formData: FormData
): Promise<{ url?: string; errore?: string }> {
  const user = await getCurrentUser();
  if (!user || !canEditAny(user)) return { errore: "Sessione scaduta: rientra e riprova." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { errore: "Nessun file da caricare." };
  if (!IMMAGINE_MIME_AMMESSI.includes(file.type)) {
    return { errore: "Formato non supportato: usa un'immagine PNG, JPG, GIF o WEBP." };
  }
  if (file.size > IMMAGINE_MAX_BYTE) {
    return { errore: "Immagine troppo grande: il limite è 5 MB." };
  }

  const { storedName, mime } = await saveUpload(file);
  const id = await data.createImmagineTesto(storedName, mime, user.id);
  return { url: `/api/immagine/${id}` };
}

// ===================== REGOLAMENTI ====================================
export async function saveRegolamento(formData: FormData) {
  const user = await requireUser();
  if (!canEditRegolamenti(user)) redirect("/admin");
  const titolo = str(formData, "titolo");
  const categoria = str(formData, "categoria") || "Generale";
  const file = formData.get("file");
  if (titolo && file instanceof File && file.size > 0) {
    const { storedName, mime } = await saveUpload(file);
    const testo = await extractPdfText(Buffer.from(await file.arrayBuffer()));
    await data.createRegolamento(titolo, categoria, storedName, mime || "application/pdf", testo);
    revalidatePath("/admin/regolamenti");
    revalidatePath("/regolamenti");
  }
  redirect("/admin/regolamenti");
}

export async function removeRegolamento(formData: FormData) {
  const user = await requireUser();
  if (!canEditRegolamenti(user)) redirect("/admin");
  const fileName = await data.deleteRegolamento(str(formData, "id"));
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/admin/regolamenti");
  revalidatePath("/regolamenti");
  redirect("/admin/regolamenti");
}

// ===================== CARTA INTESTATA ================================
export async function saveCartaIntestata(formData: FormData) {
  const user = await requireUser();
  if (!canEditCartaIntestata(user)) redirect("/admin");
  const titolo = str(formData, "titolo");
  const file = formData.get("file");
  if (titolo && file instanceof File && file.size > 0) {
    const { storedName, mime } = await saveUpload(file);
    await data.createCartaIntestata(titolo, storedName, mime);
    revalidatePath("/admin/carta-intestata");
    revalidatePath("/carta-intestata");
  }
  redirect("/admin/carta-intestata");
}

export async function removeCartaIntestata(formData: FormData) {
  const user = await requireUser();
  if (!canEditCartaIntestata(user)) redirect("/admin");
  const fileName = await data.deleteCartaIntestata(str(formData, "id"));
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/admin/carta-intestata");
  revalidatePath("/carta-intestata");
  redirect("/admin/carta-intestata");
}

// ===================== GUIDE ==========================================
export async function saveGuida(formData: FormData) {
  const user = await requireUser();
  if (!canEditGuide(user)) redirect("/admin");
  const isNew = !str(formData, "id");
  const titolo = str(formData, "titolo");

  // Solo la notizia di Formazione (vedi commento in GuidaForm): a differenza
  // di saveProcedura/saveModulo, qui non c'è un ramo "ufficiale" — questa
  // sezione è interamente di Formazione.
  const pubblicaNotiziaFormazione =
    isNew && bool(formData, "pubblicaNotiziaFormazione") && canEdit(user, "formazione");
  const autoreContattoFormazione = pubblicaNotiziaFormazione
    ? await data.getContatto(str(formData, "notiziaFormazioneAutoreContattoId"))
    : null;
  if (pubblicaNotiziaFormazione && !autoreContattoFormazione) redirect("/admin/guide?error=autoreFormazione");

  const id = await data.upsertGuida({
    id: str(formData, "id") || undefined,
    titolo,
    categoria: str(formData, "categoria") || "Generale",
    descrizione: str(formData, "descrizione"),
    // Chi ha condiviso la competenza (facoltativo, diverso dall'autore della
    // comunicazione collegata sopra): null se non selezionato.
    autoreContattoId: str(formData, "autoreContattoId") || null,
  });

  if (autoreContattoFormazione) {
    await creaComunicazioneAnnuncio({
      userId: user.id,
      autore: autoreContattoFormazione.nome,
      titolo: `Nuovo contributo in Formazione: ${titolo}`,
      corpo:
        str(formData, "notiziaFormazioneTesto") ||
        `È disponibile un nuovo contributo in "Formazione dei colleghi per i colleghi": «${titolo}». Consultalo qui sotto.`,
      categoria: "Generale",
      tipo: "formazione",
      guidaId: id,
    });
  }

  revalidatePath("/admin/guide");
  revalidatePath("/formazione/colleghi-per-colleghi");
  revalidatePath(`/formazione/colleghi-per-colleghi/${id}`);
  redirect(`/admin/guide?edit=${id}`);
}

export async function removeGuida(formData: FormData) {
  const user = await requireUser();
  if (!canEditGuide(user)) redirect("/admin");
  const fileNames = await data.deleteGuida(str(formData, "id"));
  await Promise.all(fileNames.map((f) => deleteUpload(f)));
  revalidatePath("/admin/guide");
  revalidatePath("/formazione/colleghi-per-colleghi");
  redirect("/admin/guide");
}

export async function addGuidaMateriale(formData: FormData) {
  const user = await requireUser();
  if (!canEditGuide(user)) redirect("/admin");
  const guidaId = str(formData, "guidaId");
  const titolo = str(formData, "titolo");
  const tipo = (str(formData, "tipo") as TipoGuida) || "documento";

  if (tipo === "documento") {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const { storedName, mime } = await saveUpload(file);
      await data.addGuidaMateriale(guidaId, titolo, "documento", undefined, storedName, mime);
    }
  } else {
    const url = str(formData, "url");
    if (url) await data.addGuidaMateriale(guidaId, titolo, tipo, url);
  }

  revalidatePath("/admin/guide");
  revalidatePath("/formazione/colleghi-per-colleghi");
  revalidatePath(`/formazione/colleghi-per-colleghi/${guidaId}`);
  redirect(`/admin/guide?edit=${guidaId}`);
}

export async function removeGuidaMateriale(formData: FormData) {
  const user = await requireUser();
  if (!canEditGuide(user)) redirect("/admin");
  const guidaId = str(formData, "guidaId");
  const fileName = await data.deleteGuidaMateriale(str(formData, "id"));
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/admin/guide");
  revalidatePath("/formazione/colleghi-per-colleghi");
  revalidatePath(`/formazione/colleghi-per-colleghi/${guidaId}`);
  redirect(`/admin/guide?edit=${guidaId}`);
}

// ===================== RUBRICA ========================================
export async function saveContatto(formData: FormData) {
  const user = await requireUser();
  if (!canEditRubrica(user)) redirect("/admin");
  const id = str(formData, "id") || `con-${crypto.randomUUID().slice(0, 8)}`;
  await data.upsertContatto({
    id,
    nome: str(formData, "nome"),
    ruolo: str(formData, "ruolo"),
    interno: str(formData, "interno"),
    telefono: str(formData, "telefono"),
    cellulare: str(formData, "cellulare"),
    email: str(formData, "email"),
    note: str(formData, "note"),
    fonte: str(formData, "fonte") || "manuale",
  });
  await data.setUfficiContatto(id, formData.getAll("ufficiIds").map(String));
  revalidatePath("/admin/rubrica");
  revalidatePath("/rubrica");
  redirect("/admin/rubrica");
}

export async function removeContatto(formData: FormData) {
  const user = await requireUser();
  if (!canEditRubrica(user)) redirect("/admin");
  await data.deleteContatto(str(formData, "id"));
  revalidatePath("/admin/rubrica");
  revalidatePath("/rubrica");
  redirect("/admin/rubrica");
}

// ===================== PROCEDURE ======================================
export async function saveProcedura(formData: FormData) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  const isNew = !str(formData, "id");
  const id = str(formData, "id") || `prc-${crypto.randomUUID().slice(0, 8)}`;
  const titolo = str(formData, "titolo");
  const ufficioId = str(formData, "ufficioId") || null;

  // "Pubblica anche una comunicazione ufficiale": solo in creazione e solo se
  // l'utente ha anche il permesso sulle comunicazioni ufficiali (permesso
  // indipendente da canEditProcedure, mai dedotto dall'uno all'altro). Il
  // nominativo va risolto dalla rubrica prima di scrivere qualunque cosa —
  // stesso principio di saveComunicazione: se non valido, non si salva nulla.
  const pubblicaNotizia = isNew && bool(formData, "pubblicaNotizia") && canEdit(user, "ufficiale");
  const autoreContatto = pubblicaNotizia
    ? await data.getContatto(str(formData, "notiziaAutoreContattoId"))
    : null;
  if (pubblicaNotizia && !autoreContatto) redirect("/admin/procedure?error=autore");

  await data.upsertProcedura({
    id,
    titolo,
    descrizione: str(formData, "descrizione"),
    servizio: str(formData, "servizio"),
    ufficioId,
    referente: str(formData, "referente"),
    referenteContatto: str(formData, "referenteContatto"),
    categoria: str(formData, "categoria") || "Generale",
    url: str(formData, "url"),
    pubblicato: bool(formData, "pubblicato"),
  });

  if (autoreContatto) {
    const ufficioNome = ufficioId
      ? (await data.listUffici()).find((u) => u.id === ufficioId)?.nome
      : undefined;
    await creaComunicazioneAnnuncio({
      userId: user.id,
      autore: autoreContatto.nome,
      titolo: `Nuova procedura: ${titolo}`,
      corpo: str(formData, "notiziaTesto") || `È disponibile una nuova procedura: «${titolo}». Consultala qui sotto.`,
      categoria: ufficioNome || "Generale",
      proceduraId: id,
    });
  }

  revalidatePath("/admin/procedure");
  revalidatePath("/procedure");
  revalidatePath(`/procedure/${id}`);
  redirect("/admin/procedure");
}

export async function removeProcedura(formData: FormData) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  await data.deleteProcedura(str(formData, "id"));
  revalidatePath("/admin/procedure");
  revalidatePath("/procedure");
  redirect("/admin/procedure");
}

// FAQ: stesso permesso di Procedure (canEditProcedure), di cui è una sezione.
export async function saveFaq(formData: FormData) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  const id = str(formData, "id") || `faq-${crypto.randomUUID().slice(0, 8)}`;
  const proceduraId = str(formData, "proceduraId") || null;

  await data.upsertFaq({
    id,
    domanda: str(formData, "domanda"),
    risposta: str(formData, "risposta"),
    categoria: str(formData, "categoria") || "Generale",
    proceduraId,
    pubblicato: bool(formData, "pubblicato"),
  });

  revalidatePath("/admin/faq");
  revalidatePath("/faq");
  if (proceduraId) revalidatePath(`/procedure/${proceduraId}`);
  redirect("/admin/faq");
}

export async function removeFaq(formData: FormData) {
  const user = await requireUser();
  if (!canEditProcedure(user)) redirect("/admin");
  await data.deleteFaq(str(formData, "id"));
  revalidatePath("/admin/faq");
  revalidatePath("/faq");
  redirect("/admin/faq");
}

// ===================== SEGNALAZIONI ===================================
export async function markSegnalazione(formData: FormData) {
  const user = await requireUser();
  if (!canManageSegnalazioni(user)) redirect("/admin");
  await data.markSegnalazioneLetta(str(formData, "id"), str(formData, "letta") === "true");
  revalidatePath("/admin/segnalazioni");
  redirect("/admin/segnalazioni");
}

export async function removeSegnalazione(formData: FormData) {
  const user = await requireUser();
  if (!canManageSegnalazioni(user)) redirect("/admin");
  await data.deleteSegnalazione(str(formData, "id"));
  revalidatePath("/admin/segnalazioni");
  redirect("/admin/segnalazioni");
}

// Scrive/aggiorna la risposta a una segnalazione. Testo vuoto -> no-op (non cancella
// una risposta già presente). La risposta è sempre salvata prima di provare a
// inviarla via email, così un invio fallito non fa perdere il lavoro dell'admin.
// Il nominativo è sempre scelto dalla rubrica (autoreEmail obbligatoria, vedi
// inviaSegnalazione in (site)/suggerimenti/actions.ts), quindi l'invio parte sempre,
// anche se chi ha segnalato era loggato al momento dell'invio: a differenza della
// notifica moduli (solo log), un fallimento qui va mostrato in UI.
export async function rispondiSegnalazione(formData: FormData) {
  const user = await requireUser();
  if (!canManageSegnalazioni(user)) redirect("/admin");
  const id = str(formData, "id");
  const risposta = str(formData, "risposta");
  if (!risposta) redirect("/admin/segnalazioni");

  await data.rispondiSegnalazione(id, risposta);

  const segnalazione = await data.getSegnalazione(id);
  if (segnalazione && segnalazione.autoreEmail) {
    try {
      await inviaRispostaSegnalazione(segnalazione, risposta);
      await data.segnaEmailRispostaInviata(id);
    } catch (err) {
      console.error(`[mail] invio risposta segnalazione fallito (${id}):`, err);
      revalidatePath("/admin/segnalazioni");
      redirect(`/admin/segnalazioni?emailError=${id}`);
    }
  }

  revalidatePath("/admin/segnalazioni");
  redirect("/admin/segnalazioni");
}

// Destinatario (globale) da avvisare via email quando arriva una nuova segnalazione
// dal form pubblico — vedi inviaNotificaSegnalazione in lib/mail.ts. Stesso pattern
// di salvaEmailAssistenza più sotto: una chiave in impostazioni, nessuna tabella
// dedicata.
export async function salvaEmailNotificaSegnalazioni(formData: FormData) {
  const user = await requireUser();
  if (!canManageSegnalazioni(user)) redirect("/admin");
  await data.salvaImpostazioni({
    email_notifica_segnalazioni: str(formData, "emailNotifica"),
  });
  revalidatePath("/admin/segnalazioni");
  redirect("/admin/segnalazioni");
}

// ===================== PACCHI ("Di chi è?") =============================
// Un solo form crea il pacco (data arrivo, mittente, descrizione, foto
// opzionale): niente step separato per l'allegato come in Moduli, la foto è
// un campo del form stesso, stesso pattern "un solo submit" di
// saveRegolamento/saveCartaIntestata.
export async function savePacco(formData: FormData) {
  const user = await requireUser();
  if (!canManagePacchi(user)) redirect("/admin");
  const dataArrivo = str(formData, "dataArrivo");
  if (!dataArrivo) redirect("/admin/pacchi?error=dataArrivo");

  const file = formData.get("foto");
  let fotoFileName: string | null = null;
  let fotoMime: string | null = null;
  if (file instanceof File && file.size > 0) {
    const salvato = await saveUpload(file);
    fotoFileName = salvato.storedName;
    fotoMime = salvato.mime;
  }

  await data.createPacco({
    dataArrivo,
    mittente: str(formData, "mittente"),
    descrizione: str(formData, "descrizione"),
    fotoFileName,
    fotoMime,
    creatoDa: user.id,
  });
  revalidatePath("/admin/pacchi");
  revalidatePath("/");
  redirect("/admin/pacchi");
}

export async function removePacco(formData: FormData) {
  const user = await requireUser();
  if (!canManagePacchi(user)) redirect("/admin");
  const fileName = await data.deletePacco(str(formData, "id"));
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/admin/pacchi");
  revalidatePath("/");
  redirect("/admin/pacchi");
}

// ===================== PRENOTAZIONE SALE (solo admin) ==================
// Notifica email + interruttore "sala non prenotabile" (bloccata), un unico form
// per sala in /admin/prenotazioni-sale — vedi Sala.bloccata in types/index.ts.
export async function saveSalaNotifica(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  await data.updateSalaConfig(
    id,
    str(formData, "emailNotifica"),
    str(formData, "messaggioNotifica"),
    bool(formData, "bloccata")
  );
  revalidatePath("/admin/prenotazioni-sale");
  revalidatePath("/prenotazione-sale");
  revalidatePath("/prenotazione-sale/matrimoni");
  redirect("/admin/prenotazioni-sale");
}

// Destinatari (globali, non per sala) per le richieste di assistenza Tecnica/
// Informatica segnalate nello step di conferma della prenotazione — vedi
// inviaNotificaAssistenza in lib/mail.ts.
export async function salvaEmailAssistenza(formData: FormData) {
  await requireAdmin();
  await data.salvaImpostazioni({
    email_assistenza_tecnica: str(formData, "emailAssistenzaTecnica"),
    email_assistenza_informatica: str(formData, "emailAssistenzaInformatica"),
  });
  revalidatePath("/admin/prenotazioni-sale");
  redirect("/admin/prenotazioni-sale");
}

export async function removePrenotazioneSala(formData: FormData) {
  await requireAdmin();
  await data.deletePrenotazioneSala(str(formData, "id"));
  revalidatePath("/admin/prenotazioni-sale");
  redirect("/admin/prenotazioni-sale");
}

// Mezz'ora dopo "HH:MM": stessa funzione di oraSuccessiva in
// (site)/prenotazione-sale/actions.ts, duplicata qui (moduli server-side distinti,
// stesso principio di duplicazione già accettato per raggruppaSlotConsecutivi tra
// client e server in quel file).
function oraSuccessivaBlocco(ora: string): string {
  const [h, m] = ora.split(":").map(Number);
  const totaleMinuti = h * 60 + m + 30;
  const hh = Math.floor(totaleMinuti / 60);
  const mm = totaleMinuti % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface FasciaBlocco {
  data: string;
  oraInizio: string;
  oraFine: string;
}

// Unisce gli slot di mezz'ora scelti nel calendario di BloccaSlotApp.tsx in fasce
// consecutive, stessa logica di raggruppaSlotConsecutivi in
// (site)/prenotazione-sale/actions.ts: un blocco 9:00-11:30 per 5 click
// consecutivi, non 5 righe separate.
function raggruppaSlotBlocco(slotGrezzi: string[]): FasciaBlocco[] {
  const slot = slotGrezzi
    .map((grezzo) => {
      const [dataIso, oraInizio] = grezzo.split("|");
      return dataIso && oraInizio ? { data: dataIso, ora: oraInizio } : null;
    })
    .filter((s): s is { data: string; ora: string } => s !== null)
    .sort((a, b) => (a.data === b.data ? a.ora.localeCompare(b.ora) : a.data.localeCompare(b.data)));

  const fasce: FasciaBlocco[] = [];
  for (const s of slot) {
    const ultima = fasce[fasce.length - 1];
    if (ultima && ultima.data === s.data && ultima.oraFine === s.ora) {
      ultima.oraFine = oraSuccessivaBlocco(s.ora);
    } else {
      fasce.push({ data: s.data, oraInizio: s.ora, oraFine: oraSuccessivaBlocco(s.ora) });
    }
  }
  return fasce;
}

// Blocca gli slot orari selezionati dall'admin nel calendario di una sala (vedi
// BloccaSlotApp.tsx in admin/(panel)/prenotazioni-sale/[salaId]), senza richiedere
// un motivo — inibisce singoli orari, diverso dall'interruttore "sala non
// prenotabile" sopra. Nessun controllo di sovrapposizione: il calendario mostra
// già come "bloccata" (non cliccabile) una cella bloccata in precedenza.
export async function creaBlocchiSala(formData: FormData) {
  await requireAdmin();
  const salaId = str(formData, "salaId");
  const slotGrezzi = formData.getAll("slot").map(String).filter(Boolean);
  if (!salaId || slotGrezzi.length === 0) redirect("/admin/prenotazioni-sale?error=blocco");

  const sala = await data.getSala(salaId);
  if (!sala) redirect("/admin/prenotazioni-sale?error=blocco");

  for (const fascia of raggruppaSlotBlocco(slotGrezzi)) {
    await data.creaBloccoSala({
      salaId,
      data: fascia.data,
      oraInizio: fascia.oraInizio,
      oraFine: fascia.oraFine,
    });
  }

  revalidatePath(`/admin/prenotazioni-sale/${salaId}`);
  revalidatePath("/prenotazione-sale");
  revalidatePath("/prenotazione-sale/matrimoni");
  redirect(`/admin/prenotazioni-sale/${salaId}?ok=1`);
}

export async function rimuoviBloccoSala(formData: FormData) {
  await requireAdmin();
  const salaId = str(formData, "salaId");
  await data.deleteBloccoSala(str(formData, "id"));
  revalidatePath("/prenotazione-sale");
  revalidatePath("/prenotazione-sale/matrimoni");
  if (salaId) {
    revalidatePath(`/admin/prenotazioni-sale/${salaId}`);
    redirect(`/admin/prenotazioni-sale/${salaId}`);
  }
  revalidatePath("/admin/prenotazioni-sale");
  redirect("/admin/prenotazioni-sale");
}

// ===================== UTENTI (solo admin) ============================
export async function saveUser(formData: FormData) {
  const me = await requireAdmin();
  const ruolo = (str(formData, "ruolo") as Ruolo) || "editor";
  const username = str(formData, "username");
  if (!username) redirect("/admin/utenti?error=username");

  const id = await data.upsertUser({
    id: str(formData, "id") || undefined,
    username,
    password: str(formData, "password") || undefined,
    ruolo,
    // Un admin ha sempre tutti i permessi.
    canEditUfficiali: ruolo === "admin" ? true : bool(formData, "canEditUfficiali"),
    canEditNonUfficiali: ruolo === "admin" ? true : bool(formData, "canEditNonUfficiali"),
    canEditRsu: ruolo === "admin" ? true : bool(formData, "canEditRsu"),
    canEditSicurezza: ruolo === "admin" ? true : bool(formData, "canEditSicurezza"),
    canEditEventi: ruolo === "admin" ? true : bool(formData, "canEditEventi"),
    canEditFormazione: ruolo === "admin" ? true : bool(formData, "canEditFormazione"),
    canManageSondaggi: ruolo === "admin" ? true : bool(formData, "canManageSondaggi"),
    canEditRubrica: ruolo === "admin" ? true : bool(formData, "canEditRubrica"),
    canEditRegolamenti: ruolo === "admin" ? true : bool(formData, "canEditRegolamenti"),
    canEditProcedure: ruolo === "admin" ? true : bool(formData, "canEditProcedure"),
    canEditGuide: ruolo === "admin" ? true : bool(formData, "canEditGuide"),
    canEditCartaIntestata: ruolo === "admin" ? true : bool(formData, "canEditCartaIntestata"),
    canManageSegnalazioni: ruolo === "admin" ? true : bool(formData, "canManageSegnalazioni"),
    canManagePacchi: ruolo === "admin" ? true : bool(formData, "canManagePacchi"),
    canVedereFormazioneTutti: ruolo === "admin" ? true : bool(formData, "canVedereFormazioneTutti"),
    canEsportareFormazione: ruolo === "admin" ? true : bool(formData, "canEsportareFormazione"),
    contattoId: str(formData, "contattoId") || null,
  });
  // Una nuova password invalida le sessioni aperte (vedi upsertUser): se
  // l'admin l'ha cambiata a sé stesso da qui, gli si riemette il cookie.
  if (id === me.id && str(formData, "password")) {
    const aggiornato = await data.getUserById(id);
    if (aggiornato) await createSession(id, aggiornato.sessioneVersione);
  }
  revalidatePath("/admin/utenti");
  redirect("/admin/utenti");
}

export async function removeUser(formData: FormData) {
  const me = await requireAdmin();
  const id = str(formData, "id");
  // Evita di rimanere senza admin e di cancellare sé stessi.
  if (id === me.id) redirect("/admin/utenti?error=self");
  const target = await data.getUserById(id);
  if (target?.ruolo === "admin" && (await data.countAdmins()) <= 1) {
    redirect("/admin/utenti?error=lastadmin");
  }
  await data.deleteUser(id);
  revalidatePath("/admin/utenti");
  redirect("/admin/utenti");
}

// ===================== ACCOUNT PERSONALE (qualunque utente loggato) ====
// A differenza di saveUser (solo admin, può impostare qualunque password senza
// conoscere quella attuale), qui l'utente cambia la propria: richiede la password
// attuale per conferma, come da prassi comune.
export async function cambiaPassword(formData: FormData) {
  const user = await requireUser();
  const attuale = str(formData, "attuale");
  const nuova = str(formData, "nuova");
  const conferma = str(formData, "conferma");

  const auth = await data.getUserAuthByUsername(user.username);
  if (!auth || !verifyPassword(attuale, auth.salt, auth.hash)) {
    redirect("/admin/password?error=attuale");
  }
  if (nuova.length < 8) {
    redirect("/admin/password?error=corta");
  }
  if (nuova !== conferma) {
    redirect("/admin/password?error=conferma");
  }
  // Il cambio password chiude le sessioni aperte altrove: su questo PC si
  // riemette subito il cookie con la nuova versione, per restare dentro.
  const versione = await data.updatePasswordUtente(user.id, nuova);
  await createSession(user.id, versione);
  redirect("/admin/password?ok=1");
}

// ===================== UFFICI (solo admin) =============================
// Un unico form gestisce creazione/rinomina/riassegnazione a qualunque livello
// (Area/Settore/Ufficio): `livello` arriva da un campo nascosto diverso per
// ciascun "+ nuovo ..." e viene ignorato in aggiornamento (vedi upsertUnita).
export async function saveUfficio(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const nome = str(formData, "nome");
  const livello = (str(formData, "livello") || "ufficio") as LivelloUfficio;
  const parentId = str(formData, "parentId") || null;
  if (nome) {
    await data.upsertUnita({ id: id || undefined, nome, livello, parentId });
    revalidateUffici();
  }
  redirect("/admin/uffici");
}

export async function removeUfficio(formData: FormData) {
  await requireAdmin();
  const esito = await data.deleteUnita(str(formData, "id"));
  revalidateUffici();
  if (esito !== "ok") redirect(`/admin/uffici?error=${esito}`);
  redirect("/admin/uffici");
}

// Responsabili di un nodo dell'organigramma. Azione separata da saveUfficio (che
// rinomina/riassegna il nodo) perché il picker manda un elenco variabile di
// contatti: un elenco vuoto è una scelta legittima ("nessun responsabile, eredita
// dal livello superiore") e va distinta dal semplice non aver toccato il campo.
export async function saveResponsabiliUfficio(formData: FormData) {
  await requireAdmin();
  const ufficioId = str(formData, "ufficioId");
  if (ufficioId) {
    await data.setResponsabiliUfficio(
      ufficioId,
      formData.getAll("responsabiliIds").map(String).filter(Boolean)
    );
    revalidateUffici();
  }
  // Ancora l'hash sul nodo appena modificato: su una navigazione con hash Next.js
  // scrolla all'elemento con quell'id invece che in cima alla pagina (stesso motivo
  // per cui i Link in uffici/page.tsx portano lo stesso #ufficio-<id>), altrimenti
  // dopo "Salva" ci si ritroverebbe in cima all'organigramma.
  redirect(`/admin/uffici#ufficio-${ufficioId}`);
}

// Persone assegnate a un nodo dell'organigramma (tabella rubrica_uffici, la
// stessa scritta da saveContatto in rubrica): a differenza dei responsabili,
// qui si aggiunge/rimuove un nominativo alla volta dal pannello Uffici, senza
// passare per il form di modifica del contatto. Chiamate direttamente dal
// client (PersoneUfficio), niente FormData/redirect: la UI aggiorna la lista
// in modo ottimistico e revalida in background, stesso schema di
// salvaEtichetta in menu/MenuSortableList.tsx.
export async function aggiungiPersonaUfficio(ufficioId: string, contattoId: string) {
  await requireAdmin();
  await data.aggiungiContattoAUfficio(contattoId, ufficioId);
  revalidateUffici();
}

export async function rimuoviPersonaUfficio(ufficioId: string, contattoId: string) {
  await requireAdmin();
  await data.rimuoviContattoDaUfficio(contattoId, ufficioId);
  revalidateUffici();
}

// ===================== MODULI ==========================================
// Risolve sempre l'ufficio dal DB (mai da un valore postato dal client) prima
// di verificare il permesso, stesso trust model di assertCanEditComunicazione.
// canManageModuloItem aggiunge la proprietà al permesso per-ufficio: un editor
// non-admin può gestire allegati/domande solo dei moduli che ha creato lui.
async function assertCanManageModulo(moduloId: string) {
  const user = await requireUser();
  const [modulo, uffici] = await Promise.all([data.getModulo(moduloId), data.listUffici()]);
  if (!modulo || !canManageModuloItem(user, modulo, uffici)) redirect("/admin/moduli");
  return { user, modulo };
}

// L'editor (ModuloEditor, client) manda l'intero elenco domande come JSON in
// un campo nascosto "campi": qui viene validato/normalizzato prima di essere
// passato a data.saveModuloConCampi, che salva modulo + domande in un colpo
// solo (nessun round-trip separato per aggiungere/togliere una domanda).
function parseCampi(formData: FormData): data.CampoModuloInput[] {
  let raw: unknown;
  try {
    raw = JSON.parse(str(formData, "campi") || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => {
      const tipo = typeof c.tipo === "string" && TIPI_CAMPO_VALIDI.has(c.tipo)
        ? (c.tipo as TipoCampoModulo)
        : "testo";
      const opzioniSorgente = Array.isArray(c.opzioni) ? c.opzioni : [];
      const etichettaGrezza = String(c.etichetta ?? "").trim();
      return {
        id: String(c.id ?? "").trim() || crypto.randomUUID(),
        // "testo_statico" arriva dal RichTextEditor (HTML da sanificare); gli
        // altri tipi sono etichette semplici digitate in un <input>.
        etichetta: tipo === "testo_statico" ? sanitizeRicco(etichettaGrezza) : etichettaGrezza,
        tipo,
        opzioni:
          tipo === "select" || tipo === "radio"
            ? opzioniSorgente.map((o) => String(o).trim()).filter(Boolean)
            : [],
        obbligatorio: c.obbligatorio === true,
      };
    })
    .filter((c) => c.etichetta.length > 0);
}

export async function saveModulo(formData: FormData) {
  const user = await requireUser();
  const id = str(formData, "id");
  const isNew = !id;
  const titolo = str(formData, "titolo");
  const ufficioId = str(formData, "ufficioId");
  const tipoRaw = str(formData, "tipo");
  const tipo = tipoRaw === "documento" ? "documento" : tipoRaw === "pdf" ? "pdf" : "form";

  const uffici = await data.listUffici();
  if (!canManageUfficio(user, ufficioId, uffici)) redirect("/admin/moduli");
  // In modifica, verifica il permesso (ufficio + proprietà) anche sul modulo
  // originale (evita che un editor sposti/modifichi un modulo altrui).
  const esistente = id ? (await assertCanManageModulo(id)).modulo : null;

  // Vedi commento analogo in saveProcedura: permesso indipendente, nominativo
  // risolto prima di scrivere qualunque cosa.
  const pubblicaNotizia = isNew && bool(formData, "pubblicaNotizia") && canEdit(user, "ufficiale");
  const autoreContatto = pubblicaNotizia
    ? await data.getContatto(str(formData, "notiziaAutoreContattoId"))
    : null;
  if (pubblicaNotizia && !autoreContatto) redirect("/admin/moduli?error=autore");

  const moduloId = await data.saveModuloConCampi(
    {
      id: id || undefined,
      titolo,
      descrizione: sanitizeRicco(str(formData, "descrizione")),
      ufficioId,
      pubblicato: bool(formData, "pubblicato"),
      tipo,
      emailNotifica: str(formData, "emailNotifica"),
      pdfDestinatario: str(formData, "pdfDestinatario"),
      pdfDestinatarioPc: str(formData, "pdfDestinatarioPc"),
      pdfCorpo: str(formData, "pdfCorpo"),
      pdfNota: str(formData, "pdfNota"),
      // In creazione: proprietario = chi crea il modulo. In modifica: il
      // proprietario originale non cambia (saveModuloConCampi lo preserva
      // comunque, questo valore serve solo a passare il typecheck).
      creatoDa: esistente ? esistente.creatoDa : user.id,
    },
    // Un modulo "documento" non ha domande: anche se l'editor non ne mostra
    // l'UI per questo tipo, ignoriamo comunque qualunque campo arrivato dal
    // client invece di fidarcene.
    tipo === "documento" ? [] : parseCampi(formData)
  );

  if (autoreContatto) {
    const ufficioNome = uffici.find((u) => u.id === ufficioId)?.nome;
    await creaComunicazioneAnnuncio({
      userId: user.id,
      autore: autoreContatto.nome,
      titolo: `Nuovo modulo: ${titolo}`,
      corpo: str(formData, "notiziaTesto") || `È disponibile un nuovo modulo: «${titolo}». Consultalo qui sotto.`,
      categoria: ufficioNome || "Generale",
      moduloId,
    });
  }

  revalidatePath("/admin/moduli");
  revalidatePath("/moduli");
  revalidatePath(`/moduli/${moduloId}`);
  redirect(`/admin/moduli?edit=${moduloId}`);
}

export async function removeModulo(formData: FormData) {
  const { modulo } = await assertCanManageModulo(str(formData, "id"));
  const fileNames = await data.deleteModulo(modulo.id);
  await Promise.all(fileNames.map((f) => deleteUpload(f)));
  revalidatePath("/admin/moduli");
  revalidatePath("/moduli");
  redirect("/admin/moduli");
}

// ===================== ALLEGATI MODULO ==================================
// Documenti di riferimento allegati al modulo in fase di composizione (non le
// risposte caricate da chi compila): stesso pattern immediato-con-redirect
// degli allegati di comunicazioni, disponibile solo dopo il primo salvataggio
// del modulo (serve un id a cui agganciare la riga).
export async function addAllegatoModuloLink(formData: FormData) {
  const moduloId = str(formData, "moduloId");
  const { modulo } = await assertCanManageModulo(moduloId);
  const url = str(formData, "url");
  if (url) {
    await data.addAllegatoModuloLink(modulo.id, str(formData, "etichetta"), url);
    revalidatePath("/admin/moduli");
    revalidatePath(`/moduli/${modulo.id}`);
  }
  redirect(`/admin/moduli?edit=${modulo.id}`);
}

export async function uploadAllegatoModuloFile(formData: FormData) {
  const moduloId = str(formData, "moduloId");
  const { modulo } = await assertCanManageModulo(moduloId);
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const { storedName, mime } = await saveUpload(file);
    const etichetta = str(formData, "etichetta") || file.name;
    await data.addAllegatoModuloFile(modulo.id, etichetta, storedName, mime);
    revalidatePath("/admin/moduli");
    revalidatePath(`/moduli/${modulo.id}`);
  }
  redirect(`/admin/moduli?edit=${modulo.id}`);
}

export async function removeAllegatoModulo(formData: FormData) {
  const moduloId = str(formData, "moduloId");
  const { modulo } = await assertCanManageModulo(moduloId);
  const fileName = await data.deleteAllegatoModulo(str(formData, "id"), modulo.id);
  if (fileName) await deleteUpload(fileName);
  revalidatePath("/admin/moduli");
  revalidatePath(`/moduli/${modulo.id}`);
  redirect(`/admin/moduli?edit=${modulo.id}`);
}

// ===================== SONDAGGI =========================================
// Stesso editor "una pagina sola" di Moduli (riusa parseCampi/sanitizeRicco
// sopra: stessa forma dei campi), ma senza permesso per-ufficio: un flag unico
// (canManageSondaggi), assegnabile a qualunque utente da "Utenti".
async function assertCanManageSondaggi() {
  const user = await requireUser();
  if (!canManageSondaggi(user)) redirect("/admin/sondaggi");
  return user;
}

// Come assertCanManageModulo: risolve sempre il sondaggio dal DB (mai da un id
// postato a caso) prima di verificare permesso+proprietà. Un editor non-admin
// può modificare/eliminare solo i sondaggi che ha creato lui.
async function assertCanManageSondaggio(sondaggioId: string) {
  const user = await assertCanManageSondaggi();
  const sondaggio = await data.getSondaggio(sondaggioId);
  if (!sondaggio || !canManageSondaggioItem(user, sondaggio)) redirect("/admin/sondaggi");
  return { user, sondaggio };
}

export async function saveSondaggio(formData: FormData) {
  const id = str(formData, "id");
  const { user, sondaggio: esistente } = id
    ? await assertCanManageSondaggio(id)
    : { user: await assertCanManageSondaggi(), sondaggio: null };
  const sondaggioId = await data.saveSondaggioConCampi(
    {
      id: id || undefined,
      titolo: str(formData, "titolo"),
      descrizione: sanitizeRicco(str(formData, "descrizione")),
      pubblicato: bool(formData, "pubblicato"),
      // In creazione: proprietario = chi crea il sondaggio. In modifica: il
      // proprietario originale non cambia (saveSondaggioConCampi lo preserva
      // comunque, questo valore serve solo a passare il typecheck).
      creatoDa: esistente ? esistente.creatoDa : user.id,
    },
    parseCampi(formData)
  );
  revalidatePath("/admin/sondaggi");
  revalidatePath("/sondaggi");
  revalidatePath(`/sondaggi/${sondaggioId}`);
  redirect(`/admin/sondaggi?edit=${sondaggioId}`);
}

export async function removeSondaggio(formData: FormData) {
  await assertCanManageSondaggio(str(formData, "id"));
  await data.deleteSondaggio(str(formData, "id"));
  revalidatePath("/admin/sondaggi");
  revalidatePath("/sondaggi");
  redirect("/admin/sondaggi");
}

// ===================== SONDAGGI COMPILAZIONI ============================
async function assertCanManageCompilazioneSondaggio(compilazioneId: string) {
  const user = await assertCanManageSondaggi();
  const compilazione = await data.getCompilazioneSondaggio(compilazioneId);
  if (!compilazione) redirect("/admin/sondaggi-ricevuti");
  return { user, compilazione };
}

export async function markCompilazioneSondaggio(formData: FormData) {
  const { compilazione } = await assertCanManageCompilazioneSondaggio(str(formData, "id"));
  await data.markCompilazioneSondaggioLetta(compilazione.id, str(formData, "letta") === "true");
  revalidatePath("/admin/sondaggi-ricevuti");
  redirect("/admin/sondaggi-ricevuti");
}

export async function removeCompilazioneSondaggio(formData: FormData) {
  const { compilazione } = await assertCanManageCompilazioneSondaggio(str(formData, "id"));
  const fileNames = await data.deleteCompilazioneSondaggio(compilazione.id);
  await Promise.all(fileNames.map((f) => deleteUpload(f)));
  revalidatePath("/admin/sondaggi-ricevuti");
  redirect("/admin/sondaggi-ricevuti");
}

// ===================== MODULI COMPILAZIONI ==============================
async function assertCanManageCompilazione(compilazioneId: string) {
  const user = await requireUser();
  const [compilazione, uffici] = await Promise.all([
    data.getCompilazione(compilazioneId),
    data.listUffici(),
  ]);
  if (!compilazione || !canManageUfficio(user, compilazione.ufficioId, uffici)) {
    redirect("/admin/moduli-ricevuti");
  }
  return { user, compilazione };
}

export async function markCompilazione(formData: FormData) {
  const { compilazione } = await assertCanManageCompilazione(str(formData, "id"));
  await data.markCompilazioneLetta(compilazione.id, str(formData, "letta") === "true");
  revalidatePath("/admin/moduli-ricevuti");
  redirect("/admin/moduli-ricevuti");
}

export async function removeCompilazione(formData: FormData) {
  const { compilazione } = await assertCanManageCompilazione(str(formData, "id"));
  const fileNames = await data.deleteCompilazione(compilazione.id);
  await Promise.all(fileNames.map((f) => deleteUpload(f)));
  revalidatePath("/admin/moduli-ricevuti");
  redirect("/admin/moduli-ricevuti");
}

// ===================== SYNC PRESENZE DA TIMBRATURE (Sicraweb) ==========
// Bottone in /admin/presenze per lanciare a mano la sync del giorno odierno
// e osservarne l'effetto (staging, ambiente di test Maggioli — vedi memoria
// progetto). Stessa logica dell'endpoint /api/presenze/sync usato dal cron,
// qui dietro requireAdmin() invece del Bearer SESSION_SECRET.
export async function syncPresenzeSicraweb(): Promise<
  data.RisultatoSyncPresenze | { error: string }
> {
  await requireAdmin();
  try {
    const risultato = await data.syncPresenzeDaTimbrature(oggiIso());
    revalidatePath("/admin/presenze");
    revalidatePath("/presenze");
    return risultato;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore sync presenze" };
  }
}

// Come sopra, ma solo per la Polizia Locale (vedi syncPresenzePoliziaLocale
// in lib/data.ts): turni non standard, controllata separatamente dal cron
// agli orari di inizio turno invece dei due soli del personale generale.
export async function syncPresenzeSicrawebPoliziaLocale(): Promise<
  data.RisultatoSyncPresenze | { error: string }
> {
  await requireAdmin();
  try {
    const risultato = await data.syncPresenzePoliziaLocale(oggiIso());
    revalidatePath("/admin/presenze");
    revalidatePath("/presenze");
    return risultato;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore sync presenze" };
  }
}

// ===================== MENU (solo admin) ===============================
// Riordino via drag&drop: niente redirect, la pagina aggiorna lo stato in locale
// (stesso stile di reorderServizi/reorderPortali sopra). Chiamata direttamente da
// startTransition() in MenuSortableList, non tramite <form action>.
export async function reorderMenu(menu: MenuId, chiavi: string[]) {
  await requireAdmin();
  await data.salvaOrdineMenu(menu, chiavi);
  if (menu === "admin") {
    revalidatePath("/admin/menu");
    revalidatePath("/admin", "layout");
  } else if (menu === "home") {
    revalidatePath("/admin/impostazioni");
    revalidatePath("/");
  } else {
    revalidatePath("/admin/menu");
    revalidatePath("/", "layout");
  }
}

// Salva un'etichetta personalizzata per una voce di menu/sezione home (rinomina
// inline in MenuSortableList, drag&drop escluso: nessun redirect, chiamata
// direttamente da startTransition() lato client — stesso stile di reorderMenu sopra).
// `chiave` arriva già con il prefisso di namespacing (vedi PREFISSO_ETICHETTA in
// lib/etichette-menu.ts), così questa azione resta generica e non deve conoscere
// a quale elenco appartiene la voce rinominata.
export async function salvaEtichetta(chiave: string, valore: string) {
  await requireAdmin();
  await data.salvaImpostazioni({ [chiave]: valore });
  revalidatePath("/admin/menu");
  revalidatePath("/admin/impostazioni");
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

// Attiva/disattiva la visibilità di una voce di menu sul sito pubblico (toggle in
// MenuSortableList, stesso stile "niente redirect" di salvaEtichetta sopra). `chiave`
// arriva già col prefisso di namespacing (vedi PREFISSO_PUBBLICATO in
// lib/pubblicazione-menu.ts), così questa azione resta generica.
export async function salvaPubblicazioneMenu(chiave: string, pubblicato: boolean) {
  await requireAdmin();
  await data.salvaImpostazioni({ [chiave]: pubblicato ? "1" : "0" });
  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
}

// ===================== IMPOSTAZIONI SITO (solo admin) ==================
export async function salvaImpostazioniGenerali(formData: FormData) {
  await requireAdmin();
  const emailAccoglienza = str(formData, "emailAccoglienza");
  if (emailAccoglienza && !emailValida(emailAccoglienza)) {
    redirect("/admin/impostazioni?error=emailAccoglienza");
  }
  await data.salvaImpostazioni({
    sito_titolo: str(formData, "sitoTitolo"),
    sito_sottotitolo: str(formData, "sitoSottotitolo"),
    [CHIAVI_BRANDING.nome]: str(formData, "enteNome"),
    [CHIAVI_BRANDING.luogo]: str(formData, "enteLuogo"),
    [CHIAVI_BRANDING.emailAccoglienza]: emailAccoglienza,
  });
  revalidatePath("/admin/impostazioni");
  revalidatePath("/", "layout");
  redirect("/admin/impostazioni?salvato=1");
}

// Posizione e link del widget meteo in home. Campo vuoto = di nuovo il default
// (Roma, vedi DEFAULT_BRANDING); coordinate fuori range o link non http(s) vengono
// rifiutati invece di salvare un valore che farebbe fallire silenziosamente il widget.
export async function salvaImpostazioniMeteo(formData: FormData) {
  await requireAdmin();
  const latitudine = str(formData, "meteoLatitudine");
  const longitudine = str(formData, "meteoLongitudine");
  const url = str(formData, "meteoUrl");
  if ((latitudine === "") !== (longitudine === "")) redirect("/admin/impostazioni?error=meteoCoppia");
  if (latitudine && !coordinataValida(latitudine, 90)) redirect("/admin/impostazioni?error=meteoLatitudine");
  if (longitudine && !coordinataValida(longitudine, 180)) redirect("/admin/impostazioni?error=meteoLongitudine");
  if (url && !urlHttpValido(url)) redirect("/admin/impostazioni?error=meteoUrl");
  await data.salvaImpostazioni({
    [CHIAVI_BRANDING.meteoLatitudine]: latitudine.replace(",", "."),
    [CHIAVI_BRANDING.meteoLongitudine]: longitudine.replace(",", "."),
    [CHIAVI_BRANDING.meteoUrl]: url,
  });
  revalidatePath("/admin/impostazioni");
  revalidatePath("/", "layout");
  redirect("/admin/impostazioni?salvato=1");
}

// Stemma e logo dell'ente. Chiamate direttamente dal client (ImmagineEnteForm):
// niente redirect, l'esito torna al componente che lo mostra inline, come
// inviaEmailProvaAction più sotto. Il browser ha già convertito l'immagine in PNG e
// l'ha ridimensionata; qui si ricontrolla tutto (firma PNG, dimensioni, peso) perché
// il client non è mai una garanzia. Il vecchio file viene cancellato solo dopo aver
// salvato il riferimento al nuovo, così un errore a metà non lascia l'ente senza
// immagine.
export async function caricaImmagineEnte(
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  const tipo = str(formData, "tipo");
  const file = formData.get("file");
  if (!eTipoImmagineEnte(tipo)) return { error: "Tipo di immagine non valido." };
  if (!(file instanceof File) || file.size === 0) return { error: "Scegli un'immagine da caricare." };

  const verifica = verificaPng(Buffer.from(await file.arrayBuffer()));
  if (!verifica.ok) return { error: verifica.errore };

  const chiave = IMMAGINI_ENTE[tipo].chiaveFile;
  const precedente = (await data.getImpostazioni())[chiave] ?? "";
  const { storedName } = await saveUpload(file);
  try {
    await data.salvaImpostazioni({ [chiave]: storedName });
  } catch (e) {
    await deleteUpload(storedName);
    throw e;
  }
  if (precedente) await deleteUpload(precedente);
  revalidatePath("/admin/impostazioni");
  revalidatePath("/", "layout");
  return { ok: true };
}

// Torna all'immagine predefinita del progetto (i segnaposto in public/ e
// src/lib/pdf-assets/).
export async function ripristinaImmagineEnte(
  tipo: string
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  if (!eTipoImmagineEnte(tipo)) return { error: "Tipo di immagine non valido." };
  const chiave = IMMAGINI_ENTE[tipo].chiaveFile;
  const precedente = (await data.getImpostazioni())[chiave] ?? "";
  await data.salvaImpostazioni({ [chiave]: "" });
  if (precedente) await deleteUpload(precedente);
  revalidatePath("/admin/impostazioni");
  revalidatePath("/", "layout");
  return { ok: true };
}

function smtpValoriDaForm(formData: FormData): Record<string, string> {
  return {
    smtp_host: str(formData, "smtpHost"),
    smtp_port: str(formData, "smtpPort"),
    smtp_secure: bool(formData, "smtpSecure") ? "true" : "false",
    smtp_user: str(formData, "smtpUser"),
    smtp_password: str(formData, "smtpPassword"),
    smtp_from: str(formData, "smtpFrom"),
  };
}

export async function salvaImpostazioniSmtp(formData: FormData) {
  await requireAdmin();
  await data.salvaImpostazioni(smtpValoriDaForm(formData));
  revalidatePath("/admin/impostazioni");
  redirect("/admin/impostazioni?smtpSalvato=1");
}

// Invio di prova richiamato dal pannello SMTP (SmtpForm, client): salva prima i
// campi correnti del form (così la prova verifica davvero quello che l'admin ha appena
// scritto, non l'ultima configurazione salvata) e poi tenta l'invio. Niente redirect:
// il risultato va mostrato inline nello stesso form, chiamata direttamente dal client
// (come le altre azioni con esito inline), non tramite <form action>.
export async function inviaEmailProvaAction(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const destinatario = str(formData, "destinatarioProva");
  if (!destinatario) return { error: "Inserisci l'indirizzo a cui inviare la prova." };
  await data.salvaImpostazioni(smtpValoriDaForm(formData));
  revalidatePath("/admin/impostazioni");
  try {
    await inviaEmailProva(destinatario);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invio non riuscito." };
  }
}
