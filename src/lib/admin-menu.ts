import {
  canEditAny,
  canEditRubrica,
  canEditRegolamenti,
  canEditProcedure,
  canEditCartaIntestata,
  canManageSegnalazioni,
  canManagePacchi,
} from "@/lib/auth";
import type { User } from "@/types";

export interface AdminMenuItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export interface AdminMenuContext {
  user: User;
  segnalazioniNonLette: number;
  compilazioniNonLette: number;
  gestisceModuli: boolean;
  gestisceSondaggi: boolean;
  compilazioniSondaggiNonLette: number;
  pacchiInAttesa: number;
  // Ha il permesso piatto, è admin, o risulta responsabile (anche indiretto,
  // vedi lib/gerarchia.ts) di almeno un collega: apre /admin/presenze
  // (calendario e statistiche di presenza dei collaboratori).
  gestiscePresenzeTeam: boolean;
}

// Elenco delle voci del menu admin con la stessa logica di visibilità/badge già in uso
// in admin/(panel)/layout.tsx, estratta qui in un array dati così può essere ordinata
// (vedi ordina-menu.ts) senza duplicare le condizioni di permesso in due punti: sia il
// layout (voci filtrate per l'utente corrente) sia la pagina di riordino /admin/menu
// (che, essendo protetta da requireAdmin(), riceve sempre un ctx con tutti i flag già
// veri per costruzione — quindi vede sempre l'elenco completo, senza bisogno di un
// parametro "mostra tutto" separato).
export function buildAdminMenuItems(ctx: AdminMenuContext): AdminMenuItem[] {
  const isAdmin = ctx.user.ruolo === "admin";
  const items: AdminMenuItem[] = [];

  // Un'unica voce "Formazione", come nel sito pubblico (ROUTES.formazione):
  // porta all'hub /formazione, che raccoglie le sottosezioni (attività
  // personali, avvisi, colleghi per colleghi, e per chi ha i permessi anche
  // il report attività dei collaboratori) invece di elencarle qui una per
  // una — evita di sparpagliarle per il menu miste ad altre voci non
  // correlate. Da lì la modifica resta disponibile esattamente come prima
  // (bottoni "Modifica"/"+ Aggiungi" già presenti sulle rispettive pagine per
  // chi è loggato/autorizzato): non serve un percorso admin separato.
  items.push({ href: "/formazione", label: "Formazione", icon: "🎓" });

  if (canEditAny(ctx.user)) {
    items.push({ href: "/admin/comunicazioni", label: "Comunicazioni", icon: "📢" });
    items.push({ href: "/admin/commenti", label: "Commenti", icon: "💬" });
  }
  if (canEditRegolamenti(ctx.user)) {
    items.push({ href: "/admin/regolamenti", label: "Regolamenti", icon: "📄" });
  }
  if (canEditCartaIntestata(ctx.user)) {
    items.push({ href: "/admin/carta-intestata", label: "Carta Intestata", icon: "📃" });
  }
  if (ctx.gestiscePresenzeTeam) {
    items.push({ href: "/admin/presenze", label: "Presenze del team", icon: "🗓️" });
  }
  if (canEditRubrica(ctx.user)) {
    items.push({ href: "/admin/rubrica", label: "Rubrica", icon: "📇" });
  }
  if (canEditProcedure(ctx.user)) {
    items.push({ href: "/admin/procedure", label: "Procedure", icon: "🗂️" });
    items.push({ href: "/admin/faq", label: "FAQ", icon: "❓" });
  }
  if (ctx.gestisceModuli) {
    items.push({ href: "/admin/moduli", label: "Moduli", icon: "📝" });
    items.push({
      href: "/admin/moduli-ricevuti",
      label: "Moduli ricevuti",
      icon: "📥",
      badge: ctx.compilazioniNonLette,
    });
  }
  if (canManageSegnalazioni(ctx.user)) {
    items.push({
      href: "/admin/segnalazioni",
      label: "Segnalazioni",
      icon: "💡",
      badge: ctx.segnalazioniNonLette,
    });
  }
  if (canManagePacchi(ctx.user)) {
    items.push({
      href: "/admin/pacchi",
      label: "Di chi è?",
      icon: "📦",
      badge: ctx.pacchiInAttesa,
    });
  }
  if (ctx.gestisceSondaggi) {
    items.push({ href: "/admin/sondaggi", label: "Sondaggi", icon: "📊" });
    items.push({
      href: "/admin/sondaggi-ricevuti",
      label: "Sondaggi ricevuti",
      icon: "📥",
      badge: ctx.compilazioniSondaggiNonLette,
    });
  }
  if (isAdmin) {
    items.push({ href: "/admin/prenotazioni-sale", label: "Prenotazione sale", icon: "🚪" });
    items.push({ href: "/admin/servizi", label: "Strumenti", icon: "🧩" });
    items.push({ href: "/admin/portali", label: "Portali", icon: "🌐" });
    items.push({ href: "/admin/uffici", label: "Uffici", icon: "🏛️" });
    items.push({ href: "/admin/utenti", label: "Utenti", icon: "👥" });
    items.push({ href: "/admin/menu", label: "Menu", icon: "↕️" });
    items.push({ href: "/admin/impostazioni", label: "Impostazioni", icon: "⚙️" });
    items.push({ href: "/admin/log-attivita", label: "Log attività", icon: "🧾" });
  }

  return items;
}
