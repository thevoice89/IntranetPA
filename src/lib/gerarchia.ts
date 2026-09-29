// Gerarchia dei responsabili, derivata da uffici_responsabili (assegnati in
// /admin/uffici) + rubrica_uffici (a chi appartiene ciascun contatto). Non è
// specifico della Formazione: qualunque processo futuro che debba sapere "chi
// sovrintende chi" passa da qui, invece di reinventare il traversamento.
//
// Regola di sorveglianza: additiva, non a sostituzione. Un responsabile
// assegnato a un nodo (Area, Settore o Ufficio) sorveglia quel nodo E TUTTI I
// SUOI DISCENDENTI, anche se questi hanno un proprio responsabile diretto
// assegnato — i due si sommano, non si escludono a vicenda. Il responsabile di
// un'Area vede quindi sempre i dipendenti di ogni Settore/Ufficio sotto di
// essa, pure se quel nodo ha un capoufficio diretto assegnato. (La UI di
// admin/uffici mostra invece, riga per riga, UN SOLO responsabile "ereditato"
// a scopo di visualizzazione: quella è una regola diversa, a sostituzione —
// vedi ereditati/RigaResponsabili in admin/uffici/page.tsx — e resta tale
// perché lì si sta mostrando "chi è il responsabile di QUESTO nodo", non "chi
// deve vedere i dati di chi".)
import { antenatiDi, discendentiDi } from "@/lib/uffici-tree";
import { getContatto, getContatti, getResponsabiliPerUffici, listUffici } from "@/lib/data";
import type { Contatto } from "@/types";

// Albero uffici + responsabili propri di ciascun nodo, caricati insieme:
// entrambe le funzioni sotto risalgono o scendono lo stesso albero.
async function caricaAlbero() {
  const uffici = await listUffici();
  const perUfficio = await getResponsabiliPerUffici(uffici.map((u) => u.id));
  return { uffici, perUfficio };
}

// Chi sovrintende questa persona: i responsabili propri di ogni nodo lungo la
// catena dal suo ufficio fino alla radice (Area), sommati tutti insieme senza
// duplicati — non solo il più vicino che ne ha.
export async function responsabiliDi(contattoId: string): Promise<Contatto[]> {
  const [{ uffici, perUfficio }, contatto, contatti] = await Promise.all([
    caricaAlbero(),
    getContatto(contattoId),
    getContatti(),
  ]);
  if (!contatto || contatto.uffici.length === 0) return [];
  const ids = new Set<string>();
  for (const u of contatto.uffici) {
    for (const antenatoId of antenatiDi(u.id, uffici)) {
      for (const r of perUfficio.get(antenatoId) ?? []) ids.add(r.id);
    }
  }
  return contatti.filter((c) => ids.has(c.id));
}

// Le persone che questo contatto sovrintende: tutti i contatti assegnati a un
// ufficio di cui è responsabile diretto, o a un suo discendente. Vuoto se il
// contatto non è responsabile diretto di alcun nodo.
export async function sottopostiDi(capoContattoId: string): Promise<Contatto[]> {
  const [{ uffici, perUfficio }, contatti] = await Promise.all([caricaAlbero(), getContatti()]);
  const nodiSorvegliati = new Set<string>();
  for (const [ufficioId, responsabili] of perUfficio) {
    if (!responsabili.some((r) => r.id === capoContattoId)) continue;
    for (const id of discendentiDi(ufficioId, uffici)) nodiSorvegliati.add(id);
  }
  if (nodiSorvegliati.size === 0) return [];
  return contatti.filter((c) => c.uffici.some((u) => nodiSorvegliati.has(u.id)));
}

// Il contatto indicato sovrintende, anche indirettamente, quest'altro? Comodo
// per un check puntuale (es. autorizzare il download di un singolo file); per
// filtrare un intero elenco usare sottopostiDi() una volta sola invece di
// richiamare questa funzione riga per riga.
export async function sovrintende(capoContattoId: string, contattoId: string): Promise<boolean> {
  if (capoContattoId === contattoId) return false;
  const sottoposti = await sottopostiDi(capoContattoId);
  return sottoposti.some((c) => c.id === contattoId);
}
