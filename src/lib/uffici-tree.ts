// Funzioni pure sulla gerarchia uffici (Area -> Settore -> Ufficio). L'albero
// intero è ~40 righe: si carica una volta con listUffici() e si traversa in
// memoria, niente query ricorsive per ogni check.
import type { Ufficio } from "@/types";

function mappaFigli(tutti: Ufficio[]): Map<string, Ufficio[]> {
  const figli = new Map<string, Ufficio[]>();
  for (const u of tutti) {
    if (!u.parentId) continue;
    const list = figli.get(u.parentId) ?? [];
    list.push(u);
    figli.set(u.parentId, list);
  }
  return figli;
}

// id stesso + tutti i discendenti, a qualunque profondità.
export function discendentiDi(id: string, tutti: Ufficio[]): string[] {
  const figli = mappaFigli(tutti);
  const risultato: string[] = [];
  const coda = [id];
  while (coda.length > 0) {
    const corrente = coda.pop()!;
    risultato.push(corrente);
    for (const figlio of figli.get(corrente) ?? []) coda.push(figlio.id);
  }
  return risultato;
}

// Unione di discendentiDi su più id di partenza, senza duplicati. Usata per
// espandere l'insieme di uffici assegnato a un utente prima di filtrare
// moduli/compilazioni: assegnare un Settore vale anche per gli Uffici sotto.
export function espandiConDiscendenti(ids: string[], tutti: Ufficio[]): string[] {
  const risultato = new Set<string>();
  for (const id of ids) {
    for (const d of discendentiDi(id, tutti)) risultato.add(d);
  }
  return [...risultato];
}

// id stesso + catena dei genitori fino alla radice (Area). Usata per il check
// "l'utente gestisce questo nodo?" (o un suo antenato).
export function antenatiDi(id: string, tutti: Ufficio[]): string[] {
  const perId = new Map(tutti.map((u) => [u.id, u]));
  const risultato: string[] = [];
  let corrente: string | null = id;
  while (corrente) {
    risultato.push(corrente);
    corrente = perId.get(corrente)?.parentId ?? null;
  }
  return risultato;
}

// id stesso + discendenti + antenati: l'intero ramo verticale del nodo. Un
// contatto assegnato a un'Area o un Settore appartiene automaticamente anche
// agli uffici sottostanti: chi cerca "chi è assente" su un Ufficio deve quindi
// vedere anche il responsabile del Settore/Area che lo contiene.
export function ramoDi(id: string, tutti: Ufficio[]): string[] {
  return [...new Set([...discendentiDi(id, tutti), ...antenatiDi(id, tutti)])];
}

// [Area, Settore, Ufficio] (solo i livelli presenti nella catena) per mostrare
// il percorso completo nella UI, radice -> foglia.
export function breadcrumb(id: string, tutti: Ufficio[]): Ufficio[] {
  const perId = new Map(tutti.map((u) => [u.id, u]));
  const catena: Ufficio[] = [];
  let corrente: string | null = id;
  while (corrente) {
    const nodo: Ufficio | undefined = perId.get(corrente);
    if (!nodo) break;
    catena.push(nodo);
    corrente = nodo.parentId;
  }
  return catena.reverse();
}

export interface UfficioIndentato extends Ufficio {
  profondita: number; // 0 = Area, 1 = Settore, 2 = Ufficio
}

// Elenco depth-first (Area, i suoi Settori, gli Uffici di ciascuno, Area
// successiva, ...) con la profondità di indentazione: usato dal picker
// gerarchico e dalla gestione ad albero in admin.
export function elencoIndentato(tutti: Ufficio[]): UfficioIndentato[] {
  const figli = mappaFigli(tutti);
  const radici = tutti.filter((u) => !u.parentId);
  const ordinaPerNome = (a: Ufficio, b: Ufficio) => a.nome.localeCompare(b.nome, "it");
  radici.sort(ordinaPerNome);
  for (const list of figli.values()) list.sort(ordinaPerNome);

  const risultato: UfficioIndentato[] = [];
  function visita(nodo: Ufficio, profondita: number) {
    risultato.push({ ...nodo, profondita });
    for (const figlio of figli.get(nodo.id) ?? []) visita(figlio, profondita + 1);
  }
  for (const radice of radici) visita(radice, 0);
  return risultato;
}
