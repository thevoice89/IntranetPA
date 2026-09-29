// Applica un ordinamento manuale salvato (drag&drop admin) a un elenco fisso definito
// nel codice, con fallback automatico "posizione nel codice" per qualunque voce priva
// ancora di una riga salvata — copre sia lo stato iniziale (nessuno ha mai riordinato:
// ordine invariato) sia una voce aggiunta al codice dopo che l'ordine è già stato
// personalizzato (appare in coda). Nessuna voce viene mai persa o duplicata: è un
// riordino, non un filtro.
export function ordinaConFallback<T>(
  items: T[],
  chiaveDi: (item: T) => string,
  ordine: Map<string, number>
): T[] {
  const conOrdine: T[] = [];
  const senzaOrdine: T[] = [];
  for (const item of items) {
    (ordine.has(chiaveDi(item)) ? conOrdine : senzaOrdine).push(item);
  }
  conOrdine.sort((a, b) => ordine.get(chiaveDi(a))! - ordine.get(chiaveDi(b))!);
  return [...conOrdine, ...senzaOrdine];
}
