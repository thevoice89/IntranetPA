import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { getUserById } from "@/lib/data";
import { safeEqual } from "@/lib/password";
import { HEADER_PERCORSO_RICHIESTO, percorsoInterno } from "@/lib/ritorno-login";
import { antenatiDi } from "@/lib/uffici-tree";
import type { User, TipoComunicazione, Ufficio, Comunicazione, Modulo, Sondaggio, FormazioneAvviso } from "@/types";

// Sessione utente: cookie firmato HMAC che contiene id utente, scadenza e
// versione di sessione.

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 giorni

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // In produzione un segreto mancante non può ripiegare su un valore scritto
  // nel codice: chiunque lo legga potrebbe firmarsi il cookie dell'admin.
  // Meglio un login che fallisce (errore chiaro nei log) di uno aggirabile.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET non configurato: impostarlo nel .env");
  }
  return "dev-secret-cambiami";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

// Token: "<userId>.<scadenza>.<versione>.<firma>". La versione è
// users.sessione_versione al momento del login: un cambio password la
// incrementa e tutti i cookie emessi prima smettono di valere (anche quelli
// rimasti su un altro PC). I token emessi prima di questo campo
// ("<userId>.<scadenza>.<firma>") valgono come versione 0, così l'aggiornamento
// non disconnette nessuno.
function makeToken(userId: string, versione: number): string {
  const payload = `${userId}.${Date.now() + MAX_AGE * 1000}.${versione}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): { userId: string; versione: number } | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!safeEqual(sig, sign(payload))) return null;
  const [userId, exp, versione = "0"] = payload.split(".");
  if (!userId || !exp || Number(exp) < Date.now()) return null;
  return { userId, versione: Number(versione) };
}

export async function createSession(userId: string, versione: number): Promise<void> {
  const store = await cookies();
  // Secure solo se la richiesta è arrivata in HTTPS (Traefik lo dichiara in
  // X-Forwarded-Proto, es. dietro un proxy HTTPS): in rete locale, solo
  // HTTP, il browser non rispedirebbe mai un cookie Secure e il login non
  // funzionerebbe.
  const https = (await headers()).get("x-forwarded-proto") === "https";
  store.set(COOKIE, makeToken(userId, versione), {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: MAX_AGE,
  });
}

// Autorizzazione delle route chiamate dai cron (/api/presenze/sync):
// header "Authorization: Bearer <SYNC_TOKEN>". Token
// dedicato e non SESSION_SECRET: chi configura un cron non deve avere in mano
// la chiave che firma le sessioni, con cui si forgia il cookie di qualunque
// utente (admin compreso). Finché SYNC_TOKEN non è impostato vale ancora
// SESSION_SECRET, per non rompere i cron già configurati; impostandolo, il
// vecchio valore smette di essere accettato.
export function autorizzaSync(req: Request): boolean {
  const token = process.env.SYNC_TOKEN || process.env.SESSION_SECRET;
  if (!token) return false;
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${token}`);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const sessione = verifyToken(store.get(COOKIE)?.value);
  if (!sessione) return null;
  const user = await getUserById(sessione.userId);
  if (!user || user.sessioneVersione !== sessione.versione) return null;
  return user;
}

// --- Guard di autorizzazione (server components / actions) ------------
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    // Percorso richiesto (lo aggiunge src/middleware.ts): dopo il login
    // loginAction riporta lì invece che sempre in /admin.
    const richiesto = percorsoInterno((await headers()).get(HEADER_PERCORSO_RICHIESTO));
    redirect(richiesto ? `/admin/login?next=${encodeURIComponent(richiesto)}` : "/admin/login");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.ruolo !== "admin") redirect("/admin");
  return user;
}

// Può l'utente modificare comunicazioni del tipo indicato?
export function canEdit(user: User, tipo: TipoComunicazione): boolean {
  if (user.ruolo === "admin") return true;
  if (tipo === "ufficiale") return user.canEditUfficiali;
  if (tipo === "rsu") return user.canEditRsu;
  if (tipo === "sicurezza") return user.canEditSicurezza;
  if (tipo === "eventi") return user.canEditEventi;
  if (tipo === "formazione") return user.canEditFormazione;
  return user.canEditNonUfficiali;
}

// L'utente può gestire almeno un tipo di comunicazione?
export function canEditAny(user: User): boolean {
  return (
    user.ruolo === "admin" ||
    user.canEditUfficiali ||
    user.canEditNonUfficiali ||
    user.canEditRsu ||
    user.canEditSicurezza ||
    user.canEditEventi ||
    user.canEditFormazione
  );
}

// Può l'utente modificare/eliminare QUESTA comunicazione? A differenza di canEdit
// (permesso sul tipo, es. "posso gestire le ufficiali?"), qui si aggiunge la
// proprietà: un editor non-admin deve anche essere l'autore originale
// (c.creatoDa), altrimenti la vede in elenco ma non può toccarla. L'admin
// bypassa sempre, come per canEdit.
export function canEditComunicazioneItem(user: User, c: Comunicazione): boolean {
  if (!canEdit(user, c.tipo)) return false;
  return user.ruolo === "admin" || c.creatoDa === user.id;
}

// Può l'utente modificare/eliminare QUESTO avviso di formazione? A differenza
// di Comunicazione/Modulo non c'è un permesso sul tipo a monte — nella
// bacheca "Avvisi e opportunità formative" chiunque sia loggato può
// pubblicare (vedi (site)/formazione/avvisi/actions.ts): basta essere il
// proprietario originale o l'admin, stesso principio di canEditComunicazioneItem.
export function canEditFormazioneAvviso(user: User, avviso: FormazioneAvviso): boolean {
  return user.ruolo === "admin" || avviso.creatoDa === user.id;
}

// Può l'utente gestire moduli/compilazioni dell'ufficio (o Settore/Area) indicato?
// Cascata: basta che l'utente sia assegnato al nodo stesso o a un suo antenato
// (es. assegnato al Settore -> gestisce anche gli Uffici sotto quel Settore).
// `uffici` è l'intera gerarchia (listUffici()), a carico del chiamante.
export function canManageUfficio(user: User, ufficioId: string, uffici: Ufficio[]): boolean {
  if (user.ruolo === "admin") return true;
  return antenatiDi(ufficioId, uffici).some((id) => user.uffici.includes(id));
}

// L'utente può gestire moduli di almeno un ufficio?
export function canManageAnyUfficio(user: User): boolean {
  return user.ruolo === "admin" || user.uffici.length > 0;
}

// Può l'utente modificare/eliminare QUESTO modulo? Aggiunge la proprietà al
// permesso per-ufficio: un editor non-admin deve anche essere il creatore
// originale (modulo.creatoDa), stesso principio di canEditComunicazioneItem.
export function canManageModuloItem(user: User, modulo: Modulo, uffici: Ufficio[]): boolean {
  if (!canManageUfficio(user, modulo.ufficioId, uffici)) return false;
  return user.ruolo === "admin" || modulo.creatoDa === user.id;
}

// Può l'utente creare/modificare Sondaggi? Nessun modello a permessi-per-ufficio
// qui (a differenza di Moduli): è un flag unico, come canEditUfficiali/NonUfficiali.
export function canManageSondaggi(user: User): boolean {
  return user.ruolo === "admin" || user.canManageSondaggi;
}

// Può l'utente modificare/eliminare QUESTO sondaggio? Aggiunge la proprietà al
// permesso canManageSondaggi (flag unico, non per-ufficio): un editor non-admin
// deve anche essere il creatore originale (sondaggio.creatoDa), stesso
// principio di canEditComunicazioneItem/canManageModuloItem.
export function canManageSondaggioItem(user: User, sondaggio: Sondaggio): boolean {
  if (!canManageSondaggi(user)) return false;
  return user.ruolo === "admin" || sondaggio.creatoDa === user.id;
}

// Permessi granulari per le sezioni admin non legate a comunicazioni/moduli/sondaggi.
// Prima erano aperte a qualunque editor loggato (solo requireUser()): ora, come tutti
// gli altri permessi sopra, un editor deve riceverli esplicitamente da "Utenti".
export function canEditRubrica(user: User): boolean {
  return user.ruolo === "admin" || user.canEditRubrica;
}

export function canEditRegolamenti(user: User): boolean {
  return user.ruolo === "admin" || user.canEditRegolamenti;
}

export function canEditProcedure(user: User): boolean {
  return user.ruolo === "admin" || user.canEditProcedure;
}

export function canEditGuide(user: User): boolean {
  return user.ruolo === "admin" || user.canEditGuide;
}

export function canEditCartaIntestata(user: User): boolean {
  return user.ruolo === "admin" || user.canEditCartaIntestata;
}

// Gestione delle segnalazioni altrui (rispondere/eliminare/segnare come lette).
export function canManageSegnalazioni(user: User): boolean {
  return user.ruolo === "admin" || user.canManageSegnalazioni;
}

// Gestione di "Di chi è?" (registrare/eliminare i pacchi in reception).
export function canManagePacchi(user: User): boolean {
  return user.ruolo === "admin" || user.canManagePacchi;
}

// Vede le attività formative di TUTTI i dipendenti (permesso piatto, non
// derivato dalla gerarchia responsabili — vedi lib/gerarchia.ts): per chi deve
// avere una vista d'insieme (es. Gestione del Personale) a prescindere da chi
// sovrintende chi.
export function canVedereFormazioneTutti(user: User): boolean {
  return user.ruolo === "admin" || user.canVedereFormazioneTutti;
}

// Può esportare la tabella Formazione in Excel (vedi /api/formazione-esporta):
// permesso a sé, pensato per un'utenza dedicata solo all'estrazione dati.
// Implica la stessa visibilità totale di canVedereFormazioneTutti — non ha
// senso poter esportare senza vedere tutti (vedi /admin/formazione).
export function canEsportareFormazione(user: User): boolean {
  return user.ruolo === "admin" || user.canEsportareFormazione;
}
