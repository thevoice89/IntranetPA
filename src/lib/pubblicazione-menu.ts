import type { MenuId } from "@/types";

// Stesso namespacing di PREFISSO_ETICHETTA in lib/etichette-menu.ts, ma per il
// flag di pubblicazione (mostra/nasconde la voce sul sito) invece che per il testo.
export const PREFISSO_PUBBLICATO: Record<MenuId, string> = {
  pubblico: "nav_pubblicato:",
  admin: "admin_pubblicato:",
  home: "home_pubblicato:",
};

// Assenza di riga = pubblicata (default): una voce resta visibile finché l'admin
// non la disattiva esplicitamente da /admin/menu. Stesso fallback "chiave assente
// = default" di applicaEtichette, qui il default è "true" invece del testo nel codice.
function ePubblicata(chiave: string, menu: MenuId, impostazioni: Record<string, string>): boolean {
  return impostazioni[`${PREFISSO_PUBBLICATO[menu]}${chiave}`] !== "0";
}

// Annota ogni voce con lo stato di pubblicazione corrente senza toglierne nessuna:
// usata in /admin/menu, dove l'admin deve vedere (e poter riattivare) anche le voci
// già disattivate.
export function applicaPubblicazione<T>(
  items: T[],
  chiaveDi: (item: T) => string,
  menu: MenuId,
  impostazioni: Record<string, string>
): (T & { pubblicato: boolean })[] {
  return items.map((item) => ({ ...item, pubblicato: ePubblicata(chiaveDi(item), menu, impostazioni) }));
}

// Toglie dall'elenco le voci disattivate: usata dove il flag deve avere effetto
// reale (sidebar del sito pubblico), non solo mostrarne lo stato.
export function filtraPubblicati<T>(
  items: T[],
  chiaveDi: (item: T) => string,
  menu: MenuId,
  impostazioni: Record<string, string>
): T[] {
  return items.filter((item) => ePubblicata(chiaveDi(item), menu, impostazioni));
}
