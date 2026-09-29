import ExcelJS from "exceljs";
import { getCurrentUser, canVedereFormazioneTutti, canEsportareFormazione } from "@/lib/auth";
import { oggiIso } from "@/lib/format";
import {
  getFormazioneAttivitaPerContatti,
  getAnagraficaPrivataPerContatti,
  getContatti,
  listUffici,
} from "@/lib/data";
import { sottopostiDi } from "@/lib/gerarchia";
import { antenatiDi } from "@/lib/uffici-tree";
import type { Contatto, Ufficio } from "@/types";

export const dynamic = "force-dynamic";

// "Settore" del contatto: risale dal (o dai, se assegnato a più nodi) proprio
// ufficio al primo antenato di livello "settore"; se il contatto è assegnato
// direttamente a un'Area (nessun Settore sopra), usa quella. Più nodi distinti
// (raro, contatto su più rami) restano elencati tutti, separati da "; ".
function settoreDiContatto(contatto: Contatto, tuttiUffici: Ufficio[]): string {
  const perId = new Map(tuttiUffici.map((u) => [u.id, u]));
  const nomi = new Set<string>();
  for (const u of contatto.uffici) {
    const catena = antenatiDi(u.id, tuttiUffici).map((id) => perId.get(id));
    const scelto = catena.find((n) => n?.livello === "settore") ?? catena.find((n) => n?.livello === "area");
    if (scelto) nomi.add(scelto.nome);
  }
  return [...nomi].join("; ");
}

// Esportazione della tabella Formazione nello schema del riepilogo fornito
// dall'ente (foglio "TABELLA FORMAZIONE" del file Excel condiviso): stesse
// colonne, stesso ordine, così il file scaricato si incolla dove serve senza
// dover rimappare nulla a mano. "Costo" non c'è (nessuna fonte dati oggi,
// omesso su richiesta esplicita invece di lasciarlo vuoto).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });
  const isAdmin = user.ruolo === "admin";
  const vedeTutti = isAdmin || canVedereFormazioneTutti(user) || canEsportareFormazione(user);

  // Senza accesso pieno, l'export è comunque permesso ma limitato ai propri
  // sottoposti (gerarchia responsabili) — stesso dato che il responsabile può
  // già consultare in /admin/formazione, solo in formato scaricabile.
  let contattoIdsFiltro: string[] | null = null;
  if (!vedeTutti) {
    if (!user.contattoId) return new Response("Non autorizzato", { status: 403 });
    const sottoposti = await sottopostiDi(user.contattoId);
    if (sottoposti.length === 0) return new Response("Non autorizzato", { status: 403 });
    contattoIdsFiltro = sottoposti.map((c) => c.id);
  }

  const [attivita, contatti, uffici] = await Promise.all([
    getFormazioneAttivitaPerContatti(contattoIdsFiltro),
    getContatti(),
    listUffici(),
  ]);
  const contattoPerId = new Map(contatti.map((c) => [c.id, c]));
  const anagraficaPerContatto = await getAnagraficaPrivataPerContatti(contatti.map((c) => c.id));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("TABELLA FORMAZIONE");
  sheet.columns = [
    { header: "Settore", key: "settore", width: 32 },
    { header: "Nome e Cognome", key: "nome", width: 26 },
    { header: "U/D", key: "genere", width: 6 },
    { header: "anno di nascita", key: "annoNascita", width: 14 },
    { header: "età", key: "eta", width: 6 },
    { header: "Data Corso", key: "dataCorso", width: 14 },
    { header: "N° ore", key: "ore", width: 8 },
    { header: "Titolo corso", key: "titoloCorso", width: 40 },
    { header: "attestato", key: "attestato", width: 10 },
    { header: "Ente Formativo", key: "enteFormativo", width: 24 },
    { header: "Modalità di fruizione", key: "modalita", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const a of attivita) {
    const contatto = contattoPerId.get(a.contattoId);
    const anagrafica = anagraficaPerContatto.get(a.contattoId);
    sheet.addRow({
      settore: contatto ? settoreDiContatto(contatto, uffici) : "",
      nome: a.contattoNome ?? "",
      genere: anagrafica?.genere ?? "",
      annoNascita: anagrafica?.dataNascita ? anagrafica.dataNascita.slice(0, 4) : "",
      eta: anagrafica?.eta ?? "",
      dataCorso: a.dataCorso,
      ore: a.oreSvolte,
      titoloCorso: a.descrizionePercorso,
      attestato: a.attestatoUrl ? "SI" : "NO",
      enteFormativo: a.enteErogatore,
      modalita: a.modalitaFruizione,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const oggi = oggiIso();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="formazione-${oggi}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
