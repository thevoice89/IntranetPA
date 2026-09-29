import type { MenuId } from "@/types";

// Prefisso di namespacing per le chiavi in `impostazioni`, una per ciascun elenco
// riordinabile (vedi MenuId in types/index.ts): evita collisioni tra una voce del
// menu pubblico e una col medesimo "chiave" nel menu admin o nelle sezioni home.
export const PREFISSO_ETICHETTA: Record<MenuId, string> = {
  pubblico: "nav_label:",
  admin: "admin_label:",
  home: "home_label:",
};

// Applica un'etichetta personalizzata (salvata dall'admin con salvaEtichetta in
// app/admin/actions.ts) al posto di quella di default definita nel codice. Stesso
// principio di fallback di ordinaConFallback in lib/ordina-menu.ts — qui per il
// testo (label) invece che per l'ordine: nessuna riga salvata = resta il default.
export function applicaEtichette<T extends { label: string }>(
  items: T[],
  chiaveDi: (item: T) => string,
  menu: MenuId,
  impostazioni: Record<string, string>
): T[] {
  const prefisso = PREFISSO_ETICHETTA[menu];
  return items.map((item) => {
    const override = impostazioni[`${prefisso}${chiaveDi(item)}`];
    return override ? { ...item, label: override } : item;
  });
}
