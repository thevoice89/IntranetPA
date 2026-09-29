// Data-access layer: tutte le query passano da qui.
import crypto from "node:crypto";
import { pool, ensureSchema } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { oggiIso } from "@/lib/format";
import { getRiepilogoTimbratureGiorno, type RiepilogoTimbraturaRecord } from "@/lib/sicraweb";
import type {
  Comunicazione,
  CommentoComunicazione,
  Servizio,
  StatoServizio,
  Portale,
  StatoPortale,
  Allegato,
  User,
  Ruolo,
  Regolamento,
  RegolamentoRisultato,
  SnippetParte,
  CartaIntestata,
  Guida,
  GuidaMateriale,
  TipoGuida,
  FormazioneAttivita,
  FormazioneAvviso,
  Contatto,
  AnagraficaPrivata,
  Procedura,
  Faq,
  Segnalazione,
  Pacco,
  MenuId,
  RisultatoRicerca,
  TipoComunicazione,
  TipoAllegato,
  CategoriaComunicazione,
  Ufficio,
  LivelloUfficio,
  ResponsabileUfficio,
  TipoCampoModulo,
  Modulo,
  TipoModulo,
  ModuloCampo,
  ModuloCompilazione,
  ModuloRisposta,
  StatisticaCampo,
  StatisticaOpzione,
  StatisticheModulo,
  Sondaggio,
  SondaggioCampo,
  SondaggioCompilazione,
  StatisticheSondaggio,
  StatoPresenza,
  Sala,
  PrenotazioneSala,
  BloccoSala,
  EventoCalendario,
  LogAttivita,
} from "@/types";

// ===================== SERVIZI =========================================
interface ServizioRow {
  id: string;
  nome: string;
  descrizione: string;
  url: string;
  icona: string;
  categoria: string;
  stato: string;
}

function toServizio(r: ServizioRow): Servizio {
  return { ...r, stato: r.stato as StatoServizio };
}

export async function getServizi(): Promise<Servizio[]> {
  await ensureSchema();
  const { rows } = await pool.query<ServizioRow>(
    "SELECT id, nome, descrizione, url, icona, categoria, stato FROM servizi ORDER BY ordine ASC NULLS LAST, creato_il ASC"
  );
  return rows.map(toServizio);
}

export async function getServizio(id: string): Promise<Servizio | null> {
  await ensureSchema();
  const { rows } = await pool.query<ServizioRow>(
    "SELECT id, nome, descrizione, url, icona, categoria, stato FROM servizi WHERE id = $1",
    [id]
  );
  return rows[0] ? toServizio(rows[0]) : null;
}

export async function upsertServizio(s: Servizio): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO servizi (id, nome, descrizione, url, icona, categoria, stato, ordine)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE((SELECT MAX(ordine) FROM servizi), 0) + 1)
     ON CONFLICT (id) DO UPDATE SET
       nome = EXCLUDED.nome, descrizione = EXCLUDED.descrizione, url = EXCLUDED.url,
       icona = EXCLUDED.icona, categoria = EXCLUDED.categoria, stato = EXCLUDED.stato`,
    [s.id, s.nome, s.descrizione, s.url, s.icona, s.categoria, s.stato]
  );
}

export async function deleteServizio(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM servizi WHERE id = $1", [id]);
}

// Persiste il nuovo ordinamento manuale (drag&drop nell'admin): ids già
// nell'ordine desiderato, assegna ordine = posizione nell'array.
export async function reorderServizi(ids: string[]): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await client.query("UPDATE servizi SET ordine = $2 WHERE id = $1", [ids[i], i]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ===================== PORTALI =========================================
interface PortaleRow {
  id: string;
  nome: string;
  descrizione: string;
  url: string;
  icona: string;
  categoria: string;
  stato: string;
}

function toPortale(r: PortaleRow): Portale {
  return { ...r, stato: r.stato as StatoPortale };
}

export async function getPortali(): Promise<Portale[]> {
  await ensureSchema();
  const { rows } = await pool.query<PortaleRow>(
    "SELECT id, nome, descrizione, url, icona, categoria, stato FROM portali ORDER BY ordine ASC NULLS LAST, creato_il ASC"
  );
  return rows.map(toPortale);
}

export async function getPortale(id: string): Promise<Portale | null> {
  await ensureSchema();
  const { rows } = await pool.query<PortaleRow>(
    "SELECT id, nome, descrizione, url, icona, categoria, stato FROM portali WHERE id = $1",
    [id]
  );
  return rows[0] ? toPortale(rows[0]) : null;
}

export async function upsertPortale(p: Portale): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO portali (id, nome, descrizione, url, icona, categoria, stato, ordine)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE((SELECT MAX(ordine) FROM portali), 0) + 1)
     ON CONFLICT (id) DO UPDATE SET
       nome = EXCLUDED.nome, descrizione = EXCLUDED.descrizione, url = EXCLUDED.url,
       icona = EXCLUDED.icona, categoria = EXCLUDED.categoria, stato = EXCLUDED.stato`,
    [p.id, p.nome, p.descrizione, p.url, p.icona, p.categoria, p.stato]
  );
}

export async function deletePortale(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM portali WHERE id = $1", [id]);
}

// Persiste il nuovo ordinamento manuale (drag&drop nell'admin): ids già
// nell'ordine desiderato, assegna ordine = posizione nell'array.
export async function reorderPortali(ids: string[]): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await client.query("UPDATE portali SET ordine = $2 WHERE id = $1", [ids[i], i]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ===================== ALLEGATI ========================================
interface AllegatoRow {
  id: string;
  comunicazione_id: string;
  tipo: string;
  etichetta: string;
  url: string | null;
  file_name: string | null;
  mime: string | null;
}

function toAllegato(r: AllegatoRow): Allegato {
  return {
    id: r.id,
    comunicazioneId: r.comunicazione_id,
    tipo: r.tipo as TipoAllegato,
    etichetta: r.etichetta,
    url: r.tipo === "file" ? `/api/file/${r.id}` : r.url ?? "",
  };
}

async function getAllegatiPerComunicazioni(
  ids: string[]
): Promise<Map<string, Allegato[]>> {
  const map = new Map<string, Allegato[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<AllegatoRow>(
    `SELECT id, comunicazione_id, tipo, etichetta, url, file_name, mime
     FROM allegati WHERE comunicazione_id = ANY($1) ORDER BY creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const a = toAllegato(r);
    const list = map.get(r.comunicazione_id) ?? [];
    list.push(a);
    map.set(r.comunicazione_id, list);
  }
  return map;
}

// Dati grezzi del file (per la rotta di download /api/file/<id>).
export async function getAllegatoFile(
  id: string
): Promise<{ fileName: string; mime: string; etichetta: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<AllegatoRow>(
    "SELECT id, comunicazione_id, tipo, etichetta, url, file_name, mime FROM allegati WHERE id = $1 AND tipo = 'file'",
    [id]
  );
  const r = rows[0];
  if (!r || !r.file_name) return null;
  return { fileName: r.file_name, mime: r.mime ?? "application/octet-stream", etichetta: r.etichetta };
}

export async function getComunicazioneIdOfAllegato(
  id: string
): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ comunicazione_id: string }>(
    "SELECT comunicazione_id FROM allegati WHERE id = $1",
    [id]
  );
  return rows[0]?.comunicazione_id ?? null;
}

export async function addAllegatoLink(
  comunicazioneId: string,
  etichetta: string,
  url: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO allegati (id, comunicazione_id, tipo, etichetta, url)
     VALUES ($1,$2,'link',$3,$4)`,
    [crypto.randomUUID(), comunicazioneId, etichetta || url, url]
  );
}

export async function addAllegatoFile(
  comunicazioneId: string,
  etichetta: string,
  fileName: string,
  mime: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO allegati (id, comunicazione_id, tipo, etichetta, file_name, mime)
     VALUES ($1,$2,'file',$3,$4,$5)`,
    [crypto.randomUUID(), comunicazioneId, etichetta, fileName, mime]
  );
}

// Rimuove la riga allegato e restituisce il file_name (se file) per cancellare il file su disco.
// Vincolata alla comunicazione su cui il chiamante ha verificato il permesso:
// senza, bastava un permesso su una comunicazione qualsiasi per eliminare gli
// allegati di tutte le altre (l'id dell'allegato è visibile nell'URL pubblico).
export async function deleteAllegato(id: string, comunicazioneId: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "DELETE FROM allegati WHERE id = $1 AND comunicazione_id = $2 RETURNING file_name",
    [id, comunicazioneId]
  );
  return rows[0]?.file_name ?? null;
}

// ===================== IMMAGINI NEL TESTO ==============================
// Immagini inserite dentro il corpo di una comunicazione dall'editor ricco.
// Non sono allegati (vedi il commento sulla tabella in db.ts): l'unico modo in
// cui si raggiungono è l'URL /api/immagine/<id> scritto nell'HTML del testo.
export async function createImmagineTesto(
  fileName: string,
  mime: string,
  creatoDa: string
): Promise<string> {
  await ensureSchema();
  const id = crypto.randomUUID();
  await pool.query(
    "INSERT INTO immagini_testo (id, file_name, mime, creato_da) VALUES ($1,$2,$3,$4)",
    [id, fileName, mime, creatoDa]
  );
  return id;
}

export async function getImmagineTesto(
  id: string
): Promise<{ fileName: string; mime: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string; mime: string }>(
    "SELECT file_name, mime FROM immagini_testo WHERE id = $1",
    [id]
  );
  const r = rows[0];
  return r ? { fileName: r.file_name, mime: r.mime } : null;
}

// ===================== COMUNICAZIONI ===================================
interface ComunicazioneRow {
  id: string;
  tipo: string;
  titolo: string;
  estratto: string;
  corpo: string;
  autore: string;
  data: string;
  categoria: string;
  in_evidenza: boolean;
  promemoria_data: string | null;
  evidenza_fine: string | null;
  evento_data: string | null;
  evento_ora_inizio: string | null;
  evento_ora_fine: string | null;
  evento_luogo: string | null;
  commenti_abilitati: boolean;
  sondaggio_id: string | null;
  sondaggio_titolo: string | null;
  sondaggio_pubblicato: boolean | null;
  procedura_id: string | null;
  procedura_titolo: string | null;
  procedura_pubblicato: boolean | null;
  modulo_id: string | null;
  modulo_titolo: string | null;
  modulo_pubblicato: boolean | null;
  guida_id: string | null;
  guida_titolo: string | null;
  creato_da: string | null;
  visualizzazioni: number;
}

function toComunicazione(r: ComunicazioneRow, allegati: Allegato[] = []): Comunicazione {
  return {
    id: r.id,
    tipo: r.tipo as TipoComunicazione,
    titolo: r.titolo,
    estratto: r.estratto,
    corpo: r.corpo,
    autore: r.autore,
    data: r.data,
    categoria: r.categoria as CategoriaComunicazione,
    inEvidenza: r.in_evidenza,
    promemoriaData: r.promemoria_data,
    evidenzaFine: r.evidenza_fine,
    eventoData: r.evento_data,
    eventoOraInizio: r.evento_ora_inizio,
    eventoOraFine: r.evento_ora_fine,
    eventoLuogo: r.evento_luogo,
    commentiAbilitati: r.commenti_abilitati,
    allegati,
    sondaggioId: r.sondaggio_id,
    sondaggioTitolo: r.sondaggio_titolo,
    sondaggioPubblicato: r.sondaggio_pubblicato,
    proceduraId: r.procedura_id,
    proceduraTitolo: r.procedura_titolo,
    proceduraPubblicato: r.procedura_pubblicato,
    moduloId: r.modulo_id,
    moduloTitolo: r.modulo_titolo,
    moduloPubblicato: r.modulo_pubblicato,
    guidaId: r.guida_id,
    guidaTitolo: r.guida_titolo,
    creatoDa: r.creato_da,
    visualizzazioni: r.visualizzazioni,
  };
}

// LEFT JOIN su sondaggi/procedure/moduli/guide: id/titolo/pubblicato sono uno
// snapshot comodo per mostrare/nascondere il rimando pubblico senza una query
// separata (vedi Comunicazione.sondaggioId/proceduraId/moduloId/guidaId in
// types/index.ts).
const COM_COLS = `
  c.id, c.tipo, c.titolo, c.estratto, c.corpo, c.autore, to_char(c.data,'YYYY-MM-DD') AS data,
  c.categoria, c.in_evidenza, to_char(c.promemoria_data,'YYYY-MM-DD') AS promemoria_data,
  to_char(c.evidenza_fine,'YYYY-MM-DD') AS evidenza_fine,
  to_char(c.evento_data,'YYYY-MM-DD') AS evento_data,
  c.evento_ora_inizio, c.evento_ora_fine, c.evento_luogo,
  c.commenti_abilitati, c.sondaggio_id, s.titolo AS sondaggio_titolo, s.pubblicato AS sondaggio_pubblicato,
  c.procedura_id, p.titolo AS procedura_titolo, p.pubblicato AS procedura_pubblicato,
  c.modulo_id, m.titolo AS modulo_titolo, m.pubblicato AS modulo_pubblicato,
  c.guida_id, g.titolo AS guida_titolo,
  c.creato_da, c.visualizzazioni
`;
const COM_JOIN =
  "FROM comunicazioni c " +
  "LEFT JOIN sondaggi s ON s.id = c.sondaggio_id " +
  "LEFT JOIN procedure p ON p.id = c.procedura_id " +
  "LEFT JOIN moduli m ON m.id = c.modulo_id " +
  "LEFT JOIN guide g ON g.id = c.guida_id";

export async function getComunicazioni(
  tipo?: TipoComunicazione
): Promise<Comunicazione[]> {
  await ensureSchema();
  const { rows } = tipo
    ? await pool.query<ComunicazioneRow>(
        `SELECT ${COM_COLS} ${COM_JOIN} WHERE c.tipo = $1 ORDER BY c.data DESC`,
        [tipo]
      )
    : await pool.query<ComunicazioneRow>(
        `SELECT ${COM_COLS} ${COM_JOIN} ORDER BY c.data DESC`
      );
  const allegati = await getAllegatiPerComunicazioni(rows.map((r) => r.id));
  return rows.map((r) => toComunicazione(r, allegati.get(r.id) ?? []));
}

export async function getComunicazione(
  id: string
): Promise<Comunicazione | null> {
  await ensureSchema();
  const { rows } = await pool.query<ComunicazioneRow>(
    `SELECT ${COM_COLS} ${COM_JOIN} WHERE c.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const allegati = await getAllegatiPerComunicazioni([id]);
  return toComunicazione(rows[0], allegati.get(id) ?? []);
}

// Incrementa il contatore di visualizzazioni: chiamata ad ogni apertura della
// pagina di dettaglio pubblica /comunicazioni/[id] (vedi Comunicazione.visualizzazioni).
export async function incrementaVisualizzazioni(id: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    "UPDATE comunicazioni SET visualizzazioni = visualizzazioni + 1 WHERE id = $1",
    [id]
  );
}

// creato_da è scritto solo in INSERT (il chiamante lo valorizza con l'utente che
// crea la comunicazione, o null per le non ufficiali pubblicate senza login): in
// ON CONFLICT DO UPDATE non compare apposta, così una modifica successiva non
// può mai cambiare il proprietario originale.
export async function upsertComunicazione(c: Comunicazione): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO comunicazioni (id, tipo, titolo, estratto, corpo, autore, data, categoria, in_evidenza, promemoria_data, evidenza_fine, evento_data, evento_ora_inizio, evento_ora_fine, evento_luogo, commenti_abilitati, sondaggio_id, procedura_id, modulo_id, guida_id, creato_da)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO UPDATE SET
       tipo = EXCLUDED.tipo, titolo = EXCLUDED.titolo, estratto = EXCLUDED.estratto,
       corpo = EXCLUDED.corpo, autore = EXCLUDED.autore, data = EXCLUDED.data,
       categoria = EXCLUDED.categoria, in_evidenza = EXCLUDED.in_evidenza,
       promemoria_data = EXCLUDED.promemoria_data, evidenza_fine = EXCLUDED.evidenza_fine,
       evento_data = EXCLUDED.evento_data, evento_ora_inizio = EXCLUDED.evento_ora_inizio,
       evento_ora_fine = EXCLUDED.evento_ora_fine, evento_luogo = EXCLUDED.evento_luogo,
       commenti_abilitati = EXCLUDED.commenti_abilitati,
       sondaggio_id = EXCLUDED.sondaggio_id, procedura_id = EXCLUDED.procedura_id,
       modulo_id = EXCLUDED.modulo_id, guida_id = EXCLUDED.guida_id`,
    [c.id, c.tipo, c.titolo, c.estratto, c.corpo, c.autore, c.data, c.categoria, c.inEvidenza, c.promemoriaData, c.evidenzaFine, c.eventoData, c.eventoOraInizio, c.eventoOraFine, c.eventoLuogo, c.commentiAbilitati, c.sondaggioId, c.proceduraId, c.moduloId, c.guidaId, c.creatoDa]
  );
}

// Restituisce i file_name degli allegati-file (per cancellarli da disco), poi
// elimina la comunicazione (gli allegati spariscono per ON DELETE CASCADE).
export async function deleteComunicazione(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "SELECT file_name FROM allegati WHERE comunicazione_id = $1 AND tipo = 'file'",
    [id]
  );
  await pool.query("DELETE FROM comunicazioni WHERE id = $1", [id]);
  return rows.map((r) => r.file_name).filter((f): f is string => Boolean(f));
}

// ===================== COMMENTI COMUNICAZIONI ==========================
interface CommentoRow {
  id: string;
  comunicazione_id: string;
  comunicazione_titolo: string;
  comunicazione_tipo: string;
  autore: string;
  testo: string;
  creato_il: string;
  letta: boolean;
}

function toCommento(r: CommentoRow): CommentoComunicazione {
  return {
    id: r.id,
    comunicazioneId: r.comunicazione_id,
    comunicazioneTitolo: r.comunicazione_titolo,
    comunicazioneTipo: r.comunicazione_tipo as TipoComunicazione,
    autore: r.autore,
    testo: r.testo,
    creatoIl: r.creato_il,
    letta: r.letta,
  };
}

const COMMENTO_COLS = `
  cc.id, cc.comunicazione_id, c.titolo AS comunicazione_titolo, c.tipo AS comunicazione_tipo,
  cc.autore, cc.testo, to_char(cc.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il, cc.letta
`;

// Commenti di una singola comunicazione, dal più vecchio al più recente (per la pagina pubblica).
export async function listCommenti(comunicazioneId: string): Promise<CommentoComunicazione[]> {
  await ensureSchema();
  const { rows } = await pool.query<CommentoRow>(
    `SELECT ${COMMENTO_COLS} FROM comunicazioni_commenti cc
     JOIN comunicazioni c ON c.id = cc.comunicazione_id
     WHERE cc.comunicazione_id = $1
     ORDER BY cc.creato_il ASC`,
    [comunicazioneId]
  );
  return rows.map(toCommento);
}

// Tutti i commenti di tutte le comunicazioni, dal più recente (per la moderazione admin).
export async function listTuttiCommenti(): Promise<CommentoComunicazione[]> {
  await ensureSchema();
  const { rows } = await pool.query<CommentoRow>(
    `SELECT ${COMMENTO_COLS} FROM comunicazioni_commenti cc
     JOIN comunicazioni c ON c.id = cc.comunicazione_id
     ORDER BY cc.creato_il DESC`
  );
  return rows.map(toCommento);
}

export async function getCommento(id: string): Promise<CommentoComunicazione | null> {
  await ensureSchema();
  const { rows } = await pool.query<CommentoRow>(
    `SELECT ${COMMENTO_COLS} FROM comunicazioni_commenti cc
     JOIN comunicazioni c ON c.id = cc.comunicazione_id
     WHERE cc.id = $1`,
    [id]
  );
  return rows[0] ? toCommento(rows[0]) : null;
}

export async function createCommento(
  comunicazioneId: string,
  autore: string,
  testo: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    "INSERT INTO comunicazioni_commenti (id, comunicazione_id, autore, testo) VALUES ($1,$2,$3,$4)",
    [crypto.randomUUID(), comunicazioneId, autore, testo]
  );
}

export async function deleteCommento(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM comunicazioni_commenti WHERE id = $1", [id]);
}

export async function markCommentoLetto(id: string, letta: boolean): Promise<void> {
  await ensureSchema();
  await pool.query("UPDATE comunicazioni_commenti SET letta = $2 WHERE id = $1", [id, letta]);
}

// tipi: null = amministratore (nessun filtro), altrimenti solo i commenti sulle
// comunicazioni dei tipi che l'utente può gestire (stesso filtro di listTuttiCommenti
// applicato lato pagina in admin/commenti, qui spostato in query per il badge/widget).
export async function countCommentiNonLetti(tipi: TipoComunicazione[] | null): Promise<number> {
  await ensureSchema();
  const { rows } = tipi
    ? await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM comunicazioni_commenti cc
         JOIN comunicazioni c ON c.id = cc.comunicazione_id
         WHERE cc.letta = false AND c.tipo = ANY($1)`,
        [tipi]
      )
    : await pool.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM comunicazioni_commenti WHERE letta = false"
      );
  return rows[0].n;
}

// ===================== USERS ===========================================
interface UserRow {
  id: string;
  username: string;
  ruolo: string;
  can_edit_ufficiali: boolean;
  can_edit_non_ufficiali: boolean;
  can_edit_rsu: boolean;
  can_edit_sicurezza: boolean;
  can_edit_eventi: boolean;
  can_edit_formazione: boolean;
  can_manage_sondaggi: boolean;
  can_edit_rubrica: boolean;
  can_edit_regolamenti: boolean;
  can_edit_procedure: boolean;
  can_edit_guide: boolean;
  can_edit_carta_intestata: boolean;
  can_manage_segnalazioni: boolean;
  can_manage_pacchi: boolean;
  can_vedere_formazione_tutti: boolean;
  can_esportare_formazione: boolean;
  contatto_id: string | null;
  sessione_versione: number;
}

function toUser(r: UserRow, uffici: string[] = []): User {
  return {
    id: r.id,
    username: r.username,
    ruolo: r.ruolo as Ruolo,
    canEditUfficiali: r.can_edit_ufficiali,
    canEditNonUfficiali: r.can_edit_non_ufficiali,
    canEditRsu: r.can_edit_rsu,
    canEditSicurezza: r.can_edit_sicurezza,
    canEditEventi: r.can_edit_eventi,
    canEditFormazione: r.can_edit_formazione,
    canManageSondaggi: r.can_manage_sondaggi,
    canEditRubrica: r.can_edit_rubrica,
    canEditRegolamenti: r.can_edit_regolamenti,
    canEditProcedure: r.can_edit_procedure,
    canEditGuide: r.can_edit_guide,
    canEditCartaIntestata: r.can_edit_carta_intestata,
    canManageSegnalazioni: r.can_manage_segnalazioni,
    canManagePacchi: r.can_manage_pacchi,
    canVedereFormazioneTutti: r.can_vedere_formazione_tutti,
    canEsportareFormazione: r.can_esportare_formazione,
    uffici,
    contattoId: r.contatto_id,
    sessioneVersione: r.sessione_versione,
  };
}

const USER_COLS =
  "id, username, ruolo, can_edit_ufficiali, can_edit_non_ufficiali, can_edit_rsu, can_edit_sicurezza, can_edit_eventi, can_edit_formazione, can_manage_sondaggi, " +
  "can_edit_rubrica, can_edit_regolamenti, can_edit_procedure, can_edit_guide, can_edit_carta_intestata, " +
  "can_manage_segnalazioni, can_manage_pacchi, can_vedere_formazione_tutti, can_esportare_formazione, contatto_id, sessione_versione";

// Uffici "operativi" di un insieme di utenti: ereditati dal contatto rubrica
// collegato (rubrica_uffici), mai assegnati manualmente sull'utente — un utente
// senza contatto collegato non eredita alcun ufficio. Riusa getUfficiPerContatti
// (dichiarata più sotto come function, quindi disponibile qui per hoisting)
// invece di duplicare la stessa query su una tabella utenti_uffici a parte.
async function getUfficiPerUtenti(
  righe: { id: string; contatto_id: string | null }[]
): Promise<Map<string, string[]>> {
  const contattoIds = righe
    .map((r) => r.contatto_id)
    .filter((id): id is string => id !== null);
  const ufficiPerContatto = await getUfficiPerContatti(contattoIds);
  const map = new Map<string, string[]>();
  for (const r of righe) {
    if (!r.contatto_id) continue;
    map.set(r.id, (ufficiPerContatto.get(r.contatto_id) ?? []).map((u) => u.id));
  }
  return map;
}

export async function getUserById(id: string): Promise<User | null> {
  await ensureSchema();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const uffici = await getUfficiPerUtenti(rows);
  return toUser(rows[0], uffici.get(id) ?? []);
}

// Per il login: include salt/hash.
export async function getUserAuthByUsername(
  username: string
): Promise<(User & { salt: string; hash: string }) | null> {
  await ensureSchema();
  const { rows } = await pool.query<UserRow & { salt: string; hash: string }>(
    `SELECT ${USER_COLS}, salt, hash FROM users WHERE username = $1`,
    [username]
  );
  const r = rows[0];
  if (!r) return null;
  const uffici = await getUfficiPerUtenti(rows);
  return { ...toUser(r, uffici.get(r.id) ?? []), salt: r.salt, hash: r.hash };
}

export async function listUsers(): Promise<User[]> {
  await ensureSchema();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${USER_COLS} FROM users ORDER BY creato_il ASC`
  );
  const uffici = await getUfficiPerUtenti(rows);
  return rows.map((r) => toUser(r, uffici.get(r.id) ?? []));
}

export async function countAdmins(): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users WHERE ruolo = 'admin'"
  );
  return rows[0].n;
}

export interface UpsertUserInput {
  id?: string;
  username: string;
  password?: string; // se vuoto in modifica, la password resta invariata
  ruolo: Ruolo;
  canEditUfficiali: boolean;
  canEditNonUfficiali: boolean;
  canEditRsu: boolean;
  canEditSicurezza: boolean;
  canEditEventi: boolean;
  canEditFormazione: boolean;
  canManageSondaggi: boolean;
  canEditRubrica: boolean;
  canEditRegolamenti: boolean;
  canEditProcedure: boolean;
  canEditGuide: boolean;
  canEditCartaIntestata: boolean;
  canManageSegnalazioni: boolean;
  canManagePacchi: boolean;
  canVedereFormazioneTutti: boolean;
  canEsportareFormazione: boolean;
  // Contatto rubrica collegato (eredita nome/ufficio per il saluto): null = nessuno.
  contattoId: string | null;
}

export async function upsertUser(input: UpsertUserInput): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  const existing = input.id ? await getUserById(input.id) : null;

  const permessi = [
    input.canEditUfficiali,
    input.canEditNonUfficiali,
    input.canEditRsu,
    input.canEditSicurezza,
    input.canEditEventi,
    input.canEditFormazione,
    input.canManageSondaggi,
    input.canEditRubrica,
    input.canEditRegolamenti,
    input.canEditProcedure,
    input.canEditGuide,
    input.canEditCartaIntestata,
    input.canManageSegnalazioni,
    input.canManagePacchi,
    input.canVedereFormazioneTutti,
    input.canEsportareFormazione,
  ];

  if (existing) {
    if (input.password) {
      const { salt, hash } = hashPassword(input.password);
      // Nuova password impostata dall'admin: le sessioni aperte con la vecchia
      // decadono (vedi makeToken in lib/auth.ts).
      await pool.query(
        `UPDATE users SET username=$2, salt=$3, hash=$4, ruolo=$5, sessione_versione=sessione_versione+1,
           can_edit_ufficiali=$6, can_edit_non_ufficiali=$7, can_edit_rsu=$8, can_edit_sicurezza=$9, can_edit_eventi=$10, can_edit_formazione=$11, can_manage_sondaggi=$12,
           can_edit_rubrica=$13, can_edit_regolamenti=$14, can_edit_procedure=$15, can_edit_guide=$16,
           can_edit_carta_intestata=$17, can_manage_segnalazioni=$18, can_manage_pacchi=$19, can_vedere_formazione_tutti=$20, can_esportare_formazione=$21, contatto_id=$22 WHERE id=$1`,
        [id, input.username, salt, hash, input.ruolo, ...permessi, input.contattoId]
      );
    } else {
      await pool.query(
        `UPDATE users SET username=$2, ruolo=$3,
           can_edit_ufficiali=$4, can_edit_non_ufficiali=$5, can_edit_rsu=$6, can_edit_sicurezza=$7, can_edit_eventi=$8, can_edit_formazione=$9, can_manage_sondaggi=$10,
           can_edit_rubrica=$11, can_edit_regolamenti=$12, can_edit_procedure=$13, can_edit_guide=$14,
           can_edit_carta_intestata=$15, can_manage_segnalazioni=$16, can_manage_pacchi=$17, can_vedere_formazione_tutti=$18, can_esportare_formazione=$19, contatto_id=$20 WHERE id=$1`,
        [id, input.username, input.ruolo, ...permessi, input.contattoId]
      );
    }
  } else {
    const { salt, hash } = hashPassword(input.password || crypto.randomUUID());
    await pool.query(
      `INSERT INTO users (id, username, salt, hash, ruolo, can_edit_ufficiali, can_edit_non_ufficiali,
         can_edit_rsu, can_edit_sicurezza, can_edit_eventi, can_edit_formazione, can_manage_sondaggi, can_edit_rubrica, can_edit_regolamenti, can_edit_procedure,
         can_edit_guide, can_edit_carta_intestata, can_manage_segnalazioni, can_manage_pacchi, can_vedere_formazione_tutti, can_esportare_formazione, contatto_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [id, input.username, salt, hash, input.ruolo, ...permessi, input.contattoId]
    );
  }
  return id;
}

export async function deleteUser(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}

// Cambio password da parte dell'utente stesso (a differenza di upsertUser, che è
// riservato all'admin e tocca anche ruolo/permessi): qui si aggiornano solo salt/hash.
// Cambia la password e invalida le sessioni aperte con la vecchia (vedi
// makeToken in lib/auth.ts). Restituisce la nuova versione di sessione, per
// riemettere subito il cookie a chi ha appena cambiato la propria password.
export async function updatePasswordUtente(id: string, password: string): Promise<number> {
  await ensureSchema();
  const { salt, hash } = hashPassword(password);
  const { rows } = await pool.query<{ sessione_versione: number }>(
    "UPDATE users SET salt=$2, hash=$3, sessione_versione=sessione_versione+1 WHERE id=$1 RETURNING sessione_versione",
    [id, salt, hash]
  );
  return rows[0]?.sessione_versione ?? 0;
}

// ===================== REGOLAMENTI =====================================
interface RegolamentoRow {
  id: string;
  titolo: string;
  categoria: string;
  file_name: string;
  mime: string;
}

function toRegolamento(r: RegolamentoRow): Regolamento {
  return { id: r.id, titolo: r.titolo, categoria: r.categoria, fileUrl: `/api/regolamento/${r.id}` };
}

export async function getRegolamenti(): Promise<Regolamento[]> {
  await ensureSchema();
  const { rows } = await pool.query<RegolamentoRow>(
    "SELECT id, titolo, categoria, file_name, mime FROM regolamenti ORDER BY categoria ASC, titolo ASC"
  );
  return rows.map(toRegolamento);
}

export async function getRegolamento(id: string): Promise<Regolamento | null> {
  await ensureSchema();
  const { rows } = await pool.query<RegolamentoRow>(
    "SELECT id, titolo, categoria, file_name, mime FROM regolamenti WHERE id = $1",
    [id]
  );
  return rows[0] ? toRegolamento(rows[0]) : null;
}

export async function getRegolamentoFile(
  id: string
): Promise<{ fileName: string; mime: string; titolo: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<RegolamentoRow>(
    "SELECT id, titolo, categoria, file_name, mime FROM regolamenti WHERE id = $1",
    [id]
  );
  const r = rows[0];
  return r ? { fileName: r.file_name, mime: r.mime, titolo: r.titolo } : null;
}

export async function createRegolamento(
  titolo: string,
  categoria: string,
  fileName: string,
  mime: string,
  testo: string = ""
): Promise<void> {
  await ensureSchema();
  await pool.query(
    "INSERT INTO regolamenti (id, titolo, categoria, file_name, mime, testo) VALUES ($1,$2,$3,$4,$5,$6)",
    [crypto.randomUUID(), titolo, categoria || "Generale", fileName, mime, testo]
  );
}

// Delimitatori per gli estratti di ts_headline: caratteri di controllo che
// non possono comparire nel testo reale, così parseSnippet può individuarli
// senza ambiguità e il componente React li rende con <mark> senza bisogno
// di dangerouslySetInnerHTML.
const HL_START = "";
const HL_END = "";

function parseSnippet(snippet: string): SnippetParte[] {
  const parti: SnippetParte[] = [];
  let resto = snippet;
  while (resto.length > 0) {
    const inizio = resto.indexOf(HL_START);
    if (inizio === -1) {
      parti.push({ testo: resto, match: false });
      break;
    }
    if (inizio > 0) parti.push({ testo: resto.slice(0, inizio), match: false });
    resto = resto.slice(inizio + 1);
    const fine = resto.indexOf(HL_END);
    if (fine === -1) {
      parti.push({ testo: resto, match: true });
      break;
    }
    parti.push({ testo: resto.slice(0, fine), match: true });
    resto = resto.slice(fine + 1);
  }
  return parti;
}

// Ricerca nel contenuto dei regolamenti (full-text sul testo estratto dal
// PDF, non solo sul titolo). Usata dal campo di ricerca in /regolamenti.
export async function cercaTestoRegolamenti(q: string): Promise<RegolamentoRisultato[]> {
  await ensureSchema();
  // Oltre al match sullo stem (usa l'indice GIN su testo_tsv), richiede che il
  // termine cercato compaia anche letteralmente: lo stemming italiano riduce
  // parole diverse alla stessa radice (es. "Marco" ~ "marchio"/"marcia"),
  // generando falsi positivi se ci si affida solo a testo_tsv.
  const term = `%${q}%`;
  const { rows } = await pool.query<{
    id: string;
    titolo: string;
    categoria: string;
    snippet: string;
  }>(
    `SELECT id, titolo, categoria,
       ts_headline('italian', titolo || '. ' || testo, plainto_tsquery('italian', $1),
         'MaxFragments=1, MaxWords=45, MinWords=20, StartSel=${HL_START}, StopSel=${HL_END}') AS snippet
     FROM regolamenti
     WHERE testo_tsv @@ plainto_tsquery('italian', $1)
       AND (titolo || ' ' || testo) ILIKE $2
     ORDER BY ts_rank(testo_tsv, plainto_tsquery('italian', $1)) DESC
     LIMIT 40`,
    [q, term]
  );
  return rows.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    categoria: r.categoria,
    fileUrl: `/api/regolamento/${r.id}`,
    snippetParti: parseSnippet(r.snippet),
  }));
}

// Categorie distinte già usate (per i suggerimenti nei form).
export async function getCategorieRegolamenti(): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ categoria: string }>(
    "SELECT DISTINCT categoria FROM regolamenti ORDER BY categoria ASC"
  );
  return rows.map((r) => r.categoria);
}

export async function getCategorieGuide(): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ categoria: string }>(
    "SELECT DISTINCT categoria FROM guide ORDER BY categoria ASC"
  );
  return rows.map((r) => r.categoria);
}

export async function deleteRegolamento(id: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string }>(
    "DELETE FROM regolamenti WHERE id = $1 RETURNING file_name",
    [id]
  );
  return rows[0]?.file_name ?? null;
}

// ===================== CARTA INTESTATA ==================================
interface CartaIntestataRow {
  id: string;
  titolo: string;
  file_name: string;
  mime: string;
}

function toCartaIntestata(r: CartaIntestataRow): CartaIntestata {
  return { id: r.id, titolo: r.titolo, mime: r.mime, fileUrl: `/api/carta-intestata/${r.id}` };
}

export async function getCarteIntestate(): Promise<CartaIntestata[]> {
  await ensureSchema();
  const { rows } = await pool.query<CartaIntestataRow>(
    "SELECT id, titolo, file_name, mime FROM carta_intestata ORDER BY creato_il DESC"
  );
  return rows.map(toCartaIntestata);
}

export async function getCartaIntestataFile(
  id: string
): Promise<{ fileName: string; mime: string; titolo: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<CartaIntestataRow>(
    "SELECT id, titolo, file_name, mime FROM carta_intestata WHERE id = $1",
    [id]
  );
  const r = rows[0];
  return r ? { fileName: r.file_name, mime: r.mime, titolo: r.titolo } : null;
}

export async function createCartaIntestata(
  titolo: string,
  fileName: string,
  mime: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    "INSERT INTO carta_intestata (id, titolo, file_name, mime) VALUES ($1,$2,$3,$4)",
    [crypto.randomUUID(), titolo, fileName, mime]
  );
}

export async function deleteCartaIntestata(id: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string }>(
    "DELETE FROM carta_intestata WHERE id = $1 RETURNING file_name",
    [id]
  );
  return rows[0]?.file_name ?? null;
}

// ===================== GUIDE ===========================================
interface GuidaRow {
  id: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  // Colonne legacy: usate solo per backward-compat con /api/guida/[id].
  tipo: string;
  url: string | null;
  file_name: string | null;
  mime: string | null;
  autore_contatto_id: string | null;
  autore_nome: string | null;
}

interface GuidaMaterialeRow {
  id: string;
  guida_id: string;
  titolo: string;
  tipo: string;
  url: string | null;
  file_name: string | null;
  mime: string | null;
}

function toGuidaMateriale(r: GuidaMaterialeRow): GuidaMateriale {
  return {
    id: r.id,
    guidaId: r.guida_id,
    titolo: r.titolo,
    tipo: r.tipo as TipoGuida,
    url: r.tipo === "documento" ? `/api/guida-materiale/${r.id}` : r.url ?? "",
  };
}

function toGuida(r: GuidaRow, materiali: GuidaMateriale[] = []): Guida {
  return {
    id: r.id,
    titolo: r.titolo,
    categoria: r.categoria,
    descrizione: r.descrizione,
    materiali,
    autoreContattoId: r.autore_contatto_id,
    autoreNome: r.autore_nome,
  };
}

const GUIDA_COLS =
  "g.id, g.titolo, g.categoria, g.descrizione, g.tipo, g.url, g.file_name, g.mime, " +
  "g.autore_contatto_id, a.nome AS autore_nome";
const GUIDA_JOIN = "FROM guide g LEFT JOIN rubrica a ON a.id = g.autore_contatto_id";

async function getMaterialiPerGuide(ids: string[]): Promise<Map<string, GuidaMateriale[]>> {
  const map = new Map<string, GuidaMateriale[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<GuidaMaterialeRow>(
    `SELECT id, guida_id, titolo, tipo, url, file_name, mime
     FROM guide_materiali WHERE guida_id = ANY($1)
     ORDER BY ordine ASC NULLS LAST, creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const m = toGuidaMateriale(r);
    const list = map.get(r.guida_id) ?? [];
    list.push(m);
    map.set(r.guida_id, list);
  }
  return map;
}

export async function getGuide(): Promise<Guida[]> {
  await ensureSchema();
  const { rows } = await pool.query<GuidaRow>(
    `SELECT ${GUIDA_COLS} ${GUIDA_JOIN} ORDER BY g.categoria ASC, g.titolo ASC`
  );
  const materiali = await getMaterialiPerGuide(rows.map((r) => r.id));
  return rows.map((r) => toGuida(r, materiali.get(r.id) ?? []));
}

export async function getGuida(id: string): Promise<Guida | null> {
  await ensureSchema();
  const { rows } = await pool.query<GuidaRow>(
    `SELECT ${GUIDA_COLS} ${GUIDA_JOIN} WHERE g.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const materiali = await getMaterialiPerGuide([id]);
  return toGuida(rows[0], materiali.get(id) ?? []);
}

// Backward-compat: serve il file dal vecchio campo guide.file_name.
export async function getGuidaFile(
  id: string
): Promise<{ fileName: string; mime: string; titolo: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<GuidaRow>(
    "SELECT id, titolo, categoria, descrizione, tipo, url, file_name, mime FROM guide WHERE id = $1 AND tipo = 'documento'",
    [id]
  );
  const r = rows[0];
  if (!r || !r.file_name) return null;
  return { fileName: r.file_name, mime: r.mime ?? "application/octet-stream", titolo: r.titolo };
}

// Serve il file da guide_materiali.
export async function getGuidaMaterialeFile(
  id: string
): Promise<{ fileName: string; mime: string; titolo: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<GuidaMaterialeRow>(
    "SELECT id, guida_id, titolo, tipo, url, file_name, mime FROM guide_materiali WHERE id = $1 AND tipo = 'documento'",
    [id]
  );
  const r = rows[0];
  if (!r || !r.file_name) return null;
  return { fileName: r.file_name, mime: r.mime ?? "application/octet-stream", titolo: r.titolo };
}

export interface UpsertGuidaInput {
  id?: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  autoreContattoId: string | null;
}

export async function upsertGuida(input: UpsertGuidaInput): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  await pool.query(
    `INSERT INTO guide (id, titolo, categoria, descrizione, autore_contatto_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET
       titolo = EXCLUDED.titolo, categoria = EXCLUDED.categoria,
       descrizione = EXCLUDED.descrizione, autore_contatto_id = EXCLUDED.autore_contatto_id`,
    [id, input.titolo, input.categoria, input.descrizione, input.autoreContattoId]
  );
  return id;
}

export async function addGuidaMateriale(
  guidaId: string,
  titolo: string,
  tipo: TipoGuida,
  url?: string,
  fileName?: string,
  mime?: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO guide_materiali (id, guida_id, titolo, tipo, url, file_name, mime)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [crypto.randomUUID(), guidaId, titolo, tipo, url ?? null, fileName ?? null, mime ?? null]
  );
}

export async function deleteGuidaMateriale(id: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "DELETE FROM guide_materiali WHERE id = $1 RETURNING file_name",
    [id]
  );
  return rows[0]?.file_name ?? null;
}

export async function deleteGuida(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows: mat } = await pool.query<{ file_name: string | null }>(
    "SELECT file_name FROM guide_materiali WHERE guida_id = $1 AND file_name IS NOT NULL",
    [id]
  );
  const { rows: leg } = await pool.query<{ file_name: string | null }>(
    "DELETE FROM guide WHERE id = $1 RETURNING file_name",
    [id]
  );
  return [...mat.map((r) => r.file_name), ...leg.map((r) => r.file_name)].filter(
    (f): f is string => Boolean(f)
  );
}

// ===================== FORMAZIONE (attività) ============================
// Attività formative auto-dichiarate: contattoId non è mai un valore postato
// dal client senza verifica (vedi (site)/formazione/le-mie-attivita/actions.ts,
// che lo fissa a user.contattoId e ricontrolla la proprietà su modifica/
// eliminazione). Un solo attestato per riga (colonne dirette, non una tabella
// a parte): vedi il commento sulla creazione della tabella in lib/db.ts.
interface FormazioneAttivitaRow {
  id: string;
  contatto_id: string;
  contatto_nome: string | null;
  descrizione_percorso: string;
  ente_erogatore: string;
  data_corso: string;
  ore_previste: string; // numeric torna come stringa dal driver pg
  ore_svolte: string;
  certificazione_competenze: boolean;
  modalita_fruizione: string;
  area_tematica: string;
  attestato_file_name: string | null;
  attestato_file_name_originale: string | null;
  attestato_mime: string | null;
}

function toFormazioneAttivita(r: FormazioneAttivitaRow): FormazioneAttivita {
  return {
    id: r.id,
    contattoId: r.contatto_id,
    contattoNome: r.contatto_nome ?? undefined,
    descrizionePercorso: r.descrizione_percorso,
    enteErogatore: r.ente_erogatore,
    dataCorso: r.data_corso,
    orePreviste: Number(r.ore_previste),
    oreSvolte: Number(r.ore_svolte),
    certificazioneCompetenze: r.certificazione_competenze,
    modalitaFruizione: r.modalita_fruizione,
    areaTematica: r.area_tematica,
    attestatoUrl: r.attestato_file_name ? `/api/formazione-attestato/${r.id}` : null,
    attestatoNomeOriginale: r.attestato_file_name_originale,
  };
}

// to_char(data_corso): stesso trattamento delle altre colonne DATE del
// progetto (presenze, prenotazioni sale, eventi...) — senza, il driver pg
// restituisce un oggetto Date invece di una stringa, che React rifiuta come
// figlio JSX (errore #31) non appena c'è almeno una riga da mostrare.
// "titolo_corso"/"ore" sono i nomi fisici storici della colonna (vedi lib/
// db.ts): qui si rinominano in lettura per riflettere il significato attuale
// senza una ALTER TABLE RENAME COLUMN.
const FORMAZIONE_COLS =
  "fa.id, fa.contatto_id, r.nome AS contatto_nome, fa.titolo_corso AS descrizione_percorso, " +
  "fa.ente_erogatore, to_char(fa.data_corso,'YYYY-MM-DD') AS data_corso, " +
  "fa.ore_previste, fa.ore AS ore_svolte, fa.certificazione_competenze, fa.modalita_fruizione, " +
  "fa.area_tematica, fa.attestato_file_name, fa.attestato_file_name_originale, fa.attestato_mime";
const FORMAZIONE_JOIN = "FROM formazione_attivita fa JOIN rubrica r ON r.id = fa.contatto_id";

export async function getFormazioneAttivitaContatto(contattoId: string): Promise<FormazioneAttivita[]> {
  await ensureSchema();
  const { rows } = await pool.query<FormazioneAttivitaRow>(
    `SELECT ${FORMAZIONE_COLS} ${FORMAZIONE_JOIN} WHERE fa.contatto_id = $1 ORDER BY fa.data_corso DESC`,
    [contattoId]
  );
  return rows.map(toFormazioneAttivita);
}

// contattoIds: null = nessun filtro (solo per canVedereFormazioneTutti/admin,
// mai passato direttamente da un id postato dal client).
export async function getFormazioneAttivitaPerContatti(
  contattoIds: string[] | null
): Promise<FormazioneAttivita[]> {
  await ensureSchema();
  const { rows } = contattoIds
    ? await pool.query<FormazioneAttivitaRow>(
        `SELECT ${FORMAZIONE_COLS} ${FORMAZIONE_JOIN} WHERE fa.contatto_id = ANY($1)
         ORDER BY r.nome ASC, fa.data_corso DESC`,
        [contattoIds]
      )
    : await pool.query<FormazioneAttivitaRow>(
        `SELECT ${FORMAZIONE_COLS} ${FORMAZIONE_JOIN} ORDER BY r.nome ASC, fa.data_corso DESC`
      );
  return rows.map(toFormazioneAttivita);
}

export async function getFormazioneAttivita(id: string): Promise<FormazioneAttivita | null> {
  await ensureSchema();
  const { rows } = await pool.query<FormazioneAttivitaRow>(
    `SELECT ${FORMAZIONE_COLS} ${FORMAZIONE_JOIN} WHERE fa.id = $1`,
    [id]
  );
  return rows[0] ? toFormazioneAttivita(rows[0]) : null;
}

export interface UpsertFormazioneAttivitaInput {
  id?: string;
  contattoId: string;
  descrizionePercorso: string;
  enteErogatore: string;
  dataCorso: string;
  orePreviste: number;
  oreSvolte: number;
  certificazioneCompetenze: boolean;
  modalitaFruizione: string;
  areaTematica: string;
}

// Non tocca le colonne attestato_*: quelle si scrivono solo con
// setAttestatoFormazioneAttivita, stesso principio di separazione di
// upsertGuida/addGuidaMateriale.
export async function upsertFormazioneAttivita(input: UpsertFormazioneAttivitaInput): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  await pool.query(
    `INSERT INTO formazione_attivita
       (id, contatto_id, titolo_corso, ente_erogatore, data_corso, ore_previste, ore, certificazione_competenze, modalita_fruizione, area_tematica)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       titolo_corso = EXCLUDED.titolo_corso, ente_erogatore = EXCLUDED.ente_erogatore,
       data_corso = EXCLUDED.data_corso, ore_previste = EXCLUDED.ore_previste, ore = EXCLUDED.ore,
       certificazione_competenze = EXCLUDED.certificazione_competenze,
       modalita_fruizione = EXCLUDED.modalita_fruizione, area_tematica = EXCLUDED.area_tematica`,
    [
      id,
      input.contattoId,
      input.descrizionePercorso,
      input.enteErogatore,
      input.dataCorso,
      input.orePreviste,
      input.oreSvolte,
      input.certificazioneCompetenze,
      input.modalitaFruizione,
      input.areaTematica,
    ]
  );
  return id;
}

// Sostituisce l'attestato (null = rimuovilo senza sostituirlo). Ritorna il nome
// del file precedente, se c'era, per farlo cancellare dal chiamante (uploads.ts).
export async function setAttestatoFormazioneAttivita(
  id: string,
  file: { fileName: string; fileNameOriginale: string; mime: string } | null
): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ attestato_file_name: string | null }>(
    "SELECT attestato_file_name FROM formazione_attivita WHERE id = $1",
    [id]
  );
  const vecchio = rows[0]?.attestato_file_name ?? null;
  await pool.query(
    `UPDATE formazione_attivita SET attestato_file_name = $2, attestato_file_name_originale = $3, attestato_mime = $4 WHERE id = $1`,
    [id, file?.fileName ?? null, file?.fileNameOriginale ?? null, file?.mime ?? null]
  );
  return vecchio;
}

// Elimina il record e ritorna il nome del file attestato (se c'era), per
// farlo cancellare dal chiamante — stesso pattern di deleteGuida.
export async function deleteFormazioneAttivita(id: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ attestato_file_name: string | null }>(
    "DELETE FROM formazione_attivita WHERE id = $1 RETURNING attestato_file_name",
    [id]
  );
  return rows[0]?.attestato_file_name ?? null;
}

export async function getFormazioneAttestatoFile(
  id: string
): Promise<{ fileName: string; mime: string; contattoId: string; nomeOriginale: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<{
    attestato_file_name: string | null;
    attestato_mime: string | null;
    attestato_file_name_originale: string | null;
    contatto_id: string;
  }>(
    `SELECT attestato_file_name, attestato_mime, attestato_file_name_originale, contatto_id
     FROM formazione_attivita WHERE id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r || !r.attestato_file_name) return null;
  return {
    fileName: r.attestato_file_name,
    mime: r.attestato_mime ?? "application/octet-stream",
    contattoId: r.contatto_id,
    nomeOriginale: r.attestato_file_name_originale ?? r.attestato_file_name,
  };
}

// ===================== FORMAZIONE (avvisi) ==============================
// Bacheca "Avvisi e opportunità formative": chiunque sia loggato può
// pubblicare (vedi canEditFormazioneAvviso in lib/auth.ts), niente permesso
// dedicato come per le Comunicazioni.
interface FormazioneAvvisoRow {
  id: string;
  titolo: string;
  descrizione: string;
  autore: string;
  creato_da: string | null;
  creato_il: string;
}

function toFormazioneAvviso(r: FormazioneAvvisoRow, allegati: Allegato[] = []): FormazioneAvviso {
  return {
    id: r.id,
    titolo: r.titolo,
    descrizione: r.descrizione,
    autore: r.autore,
    creatoDa: r.creato_da,
    creatoIl: new Date(r.creato_il).toISOString(),
    allegati,
  };
}

const FORMAZIONE_AVVISO_COLS = "id, titolo, descrizione, autore, creato_da, creato_il";

interface AllegatoAvvisoRow {
  id: string;
  avviso_id: string;
  tipo: string;
  etichetta: string;
  url: string | null;
  file_name: string | null;
  mime: string | null;
}

function toAllegatoAvviso(r: AllegatoAvvisoRow): Allegato {
  return {
    id: r.id,
    avvisoFormazioneId: r.avviso_id,
    tipo: r.tipo as TipoAllegato,
    etichetta: r.etichetta,
    url: r.tipo === "file" ? `/api/formazione-avviso-allegato/${r.id}` : r.url ?? "",
  };
}

async function getAllegatiPerAvvisi(ids: string[]): Promise<Map<string, Allegato[]>> {
  const map = new Map<string, Allegato[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<AllegatoAvvisoRow>(
    `SELECT id, avviso_id, tipo, etichetta, url, file_name, mime
     FROM formazione_avvisi_allegati WHERE avviso_id = ANY($1) ORDER BY creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const a = toAllegatoAvviso(r);
    const list = map.get(r.avviso_id) ?? [];
    list.push(a);
    map.set(r.avviso_id, list);
  }
  return map;
}

export async function getFormazioneAvvisi(): Promise<FormazioneAvviso[]> {
  await ensureSchema();
  const { rows } = await pool.query<FormazioneAvvisoRow>(
    `SELECT ${FORMAZIONE_AVVISO_COLS} FROM formazione_avvisi ORDER BY creato_il DESC`
  );
  const allegati = await getAllegatiPerAvvisi(rows.map((r) => r.id));
  return rows.map((r) => toFormazioneAvviso(r, allegati.get(r.id) ?? []));
}

export async function getFormazioneAvviso(id: string): Promise<FormazioneAvviso | null> {
  await ensureSchema();
  const { rows } = await pool.query<FormazioneAvvisoRow>(
    `SELECT ${FORMAZIONE_AVVISO_COLS} FROM formazione_avvisi WHERE id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  const allegati = await getAllegatiPerAvvisi([id]);
  return toFormazioneAvviso(r, allegati.get(id) ?? []);
}

export interface UpsertFormazioneAvvisoInput {
  id?: string;
  titolo: string;
  descrizione: string;
  // Ignorati in modifica (l'autore/proprietario originale non cambia): vedi
  // upsertFormazioneAvviso sotto, stesso principio di upsertComunicazione.
  autore: string;
  creatoDa: string | null;
}

export async function upsertFormazioneAvviso(input: UpsertFormazioneAvvisoInput): Promise<string> {
  await ensureSchema();
  if (input.id) {
    await pool.query(
      "UPDATE formazione_avvisi SET titolo=$2, descrizione=$3 WHERE id=$1",
      [input.id, input.titolo, input.descrizione]
    );
    return input.id;
  }
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO formazione_avvisi (id, titolo, descrizione, autore, creato_da)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, input.titolo, input.descrizione, input.autore, input.creatoDa]
  );
  return id;
}

// Elimina l'avviso e restituisce i file_name dei suoi allegati (le righe
// figlie sono già rimosse in cascata) per poter cancellare i file su disco.
export async function deleteFormazioneAvviso(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "SELECT file_name FROM formazione_avvisi_allegati WHERE avviso_id = $1 AND file_name IS NOT NULL",
    [id]
  );
  await pool.query("DELETE FROM formazione_avvisi WHERE id = $1", [id]);
  return rows.map((r) => r.file_name).filter((f): f is string => !!f);
}

export async function getAllegatoAvvisoFile(
  id: string
): Promise<{ fileName: string; mime: string; etichetta: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<AllegatoAvvisoRow>(
    "SELECT id, avviso_id, tipo, etichetta, url, file_name, mime FROM formazione_avvisi_allegati WHERE id = $1 AND tipo = 'file'",
    [id]
  );
  const r = rows[0];
  if (!r || !r.file_name) return null;
  return { fileName: r.file_name, mime: r.mime ?? "application/octet-stream", etichetta: r.etichetta };
}

export async function addAllegatoAvvisoLink(avvisoId: string, etichetta: string, url: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO formazione_avvisi_allegati (id, avviso_id, tipo, etichetta, url)
     VALUES ($1,$2,'link',$3,$4)`,
    [crypto.randomUUID(), avvisoId, etichetta || url, url]
  );
}

export async function addAllegatoAvvisoFile(
  avvisoId: string,
  etichetta: string,
  fileName: string,
  mime: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO formazione_avvisi_allegati (id, avviso_id, tipo, etichetta, file_name, mime)
     VALUES ($1,$2,'file',$3,$4,$5)`,
    [crypto.randomUUID(), avvisoId, etichetta, fileName, mime]
  );
}

// Rimuove la riga allegato e restituisce il file_name (se file) per cancellare il file su disco.
// Vincolata all'avviso su cui il chiamante ha verificato la proprietà, come deleteAllegato.
export async function deleteAllegatoAvviso(id: string, avvisoId: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "DELETE FROM formazione_avvisi_allegati WHERE id = $1 AND avviso_id = $2 RETURNING file_name",
    [id, avvisoId]
  );
  return rows[0]?.file_name ?? null;
}

// ===================== RUBRICA =========================================
// Un contatto può appartenere a più uffici (tabella rubrica_uffici, molti-a-molti
// — stesso pattern di utenti_uffici). Batch-fetch per evitare N+1 query quando
// si carica l'intero elenco.
async function getUfficiPerContatti(contattoIds: string[]): Promise<Map<string, Ufficio[]>> {
  const map = new Map<string, Ufficio[]>();
  if (contattoIds.length === 0) return map;
  const { rows } = await pool.query<{
    contatto_id: string;
    id: string;
    nome: string;
    livello: string;
    parent_id: string | null;
  }>(
    `SELECT ru.contatto_id, u.id, u.nome, u.livello, u.parent_id
     FROM rubrica_uffici ru JOIN uffici u ON u.id = ru.ufficio_id
     WHERE ru.contatto_id = ANY($1)
     ORDER BY u.nome ASC`,
    [contattoIds]
  );
  for (const r of rows) {
    const list = map.get(r.contatto_id) ?? [];
    list.push({ id: r.id, nome: r.nome, livello: r.livello as LivelloUfficio, parentId: r.parent_id });
    map.set(r.contatto_id, list);
  }
  return map;
}

// Sostituisce l'insieme di uffici assegnati a un contatto (delete + insert in transazione).
export async function setUfficiContatto(contattoId: string, ufficioIds: string[]): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM rubrica_uffici WHERE contatto_id = $1", [contattoId]);
    for (const ufficioId of ufficioIds) {
      await client.query(
        "INSERT INTO rubrica_uffici (contatto_id, ufficio_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [contattoId, ufficioId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Aggiunge/rimuove un singolo ufficio a un contatto senza toccare gli altri
// suoi uffici (a differenza di setUfficiContatto, che sostituisce l'intero
// insieme): usate da /admin/uffici, dove si assegnano persone nodo per nodo.
export async function aggiungiContattoAUfficio(contattoId: string, ufficioId: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    "INSERT INTO rubrica_uffici (contatto_id, ufficio_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [contattoId, ufficioId]
  );
}

export async function rimuoviContattoDaUfficio(contattoId: string, ufficioId: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM rubrica_uffici WHERE contatto_id = $1 AND ufficio_id = $2", [
    contattoId,
    ufficioId,
  ]);
}

interface ContattoRow {
  id: string;
  nome: string;
  ruolo: string;
  interno: string;
  telefono: string;
  cellulare: string;
  email: string;
  note: string;
  fonte: string;
}

function toContatto(r: ContattoRow, uffici: Ufficio[]): Contatto {
  return {
    id: r.id,
    nome: r.nome,
    uffici,
    ruolo: r.ruolo,
    interno: r.interno,
    telefono: r.telefono,
    cellulare: r.cellulare,
    email: r.email,
    note: r.note,
    fonte: r.fonte,
  };
}

const CONTATTO_COLS = "id, nome, ruolo, interno, telefono, cellulare, email, note, fonte";

export async function getContatti(): Promise<Contatto[]> {
  await ensureSchema();
  const { rows } = await pool.query<ContattoRow>(
    `SELECT ${CONTATTO_COLS} FROM rubrica ORDER BY nome ASC`
  );
  const uffici = await getUfficiPerContatti(rows.map((r) => r.id));
  return rows.map((r) => toContatto(r, uffici.get(r.id) ?? []));
}

export async function getContatto(id: string): Promise<Contatto | null> {
  await ensureSchema();
  const { rows } = await pool.query<ContattoRow>(
    `SELECT ${CONTATTO_COLS} FROM rubrica WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const uffici = await getUfficiPerContatti([id]);
  return toContatto(rows[0], uffici.get(id) ?? []);
}

interface AnagraficaPrivataRow {
  contatto_id: string;
  categoria_lavoro: string;
  genere: string;
  data_nascita: string | null;
  eta: number | null;
}

function toAnagraficaPrivata(r: AnagraficaPrivataRow): AnagraficaPrivata {
  return {
    contattoId: r.contatto_id,
    categoriaLavoro: r.categoria_lavoro,
    genere: r.genere,
    dataNascita: r.data_nascita,
    eta: r.eta,
  };
}

const ANAGRAFICA_COLS =
  "contatto_id, categoria_lavoro, genere, to_char(data_nascita,'YYYY-MM-DD') AS data_nascita, " +
  "DATE_PART('year', AGE(data_nascita))::int AS eta";

// Nessuna riga = dati non ancora caricati per questo contatto (es. non
// presente nel file dell'ufficio del personale): non un errore, il
// chiamante mostra semplicemente niente.
export async function getAnagraficaPrivata(contattoId: string): Promise<AnagraficaPrivata | null> {
  await ensureSchema();
  const { rows } = await pool.query<AnagraficaPrivataRow>(
    `SELECT ${ANAGRAFICA_COLS} FROM anagrafica_privata WHERE contatto_id = $1`,
    [contattoId]
  );
  return rows[0] ? toAnagraficaPrivata(rows[0]) : null;
}

// Batch, per non fare un giro a contatto per l'esportazione Formazione (vedi
// /api/formazione-esporta): contatti senza riga semplicemente non compaiono
// nella mappa, stesso principio del singolare sopra.
export async function getAnagraficaPrivataPerContatti(
  contattoIds: string[]
): Promise<Map<string, AnagraficaPrivata>> {
  const map = new Map<string, AnagraficaPrivata>();
  if (contattoIds.length === 0) return map;
  await ensureSchema();
  const { rows } = await pool.query<AnagraficaPrivataRow>(
    `SELECT ${ANAGRAFICA_COLS} FROM anagrafica_privata WHERE contatto_id = ANY($1)`,
    [contattoIds]
  );
  for (const r of rows) map.set(r.contatto_id, toAnagraficaPrivata(r));
  return map;
}

export interface UpsertContattoInput {
  id: string;
  nome: string;
  ruolo: string;
  interno: string;
  telefono: string;
  cellulare: string;
  email: string;
  note: string;
  fonte: string;
}

export async function upsertContatto(c: UpsertContattoInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO rubrica (id, nome, ruolo, interno, telefono, cellulare, email, note, fonte)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       nome = EXCLUDED.nome, ruolo = EXCLUDED.ruolo,
       interno = EXCLUDED.interno, telefono = EXCLUDED.telefono, cellulare = EXCLUDED.cellulare,
       email = EXCLUDED.email, note = EXCLUDED.note, fonte = EXCLUDED.fonte`,
    [c.id, c.nome, c.ruolo, c.interno, c.telefono, c.cellulare, c.email, c.note, c.fonte]
  );
}

export async function deleteContatto(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM rubrica WHERE id = $1", [id]);
}

// ===================== PROCEDURE ========================================
interface ProceduraRow {
  id: string;
  titolo: string;
  descrizione: string;
  servizio: string;
  ufficio_id: string | null;
  ufficio_nome: string | null;
  referente: string;
  referente_contatto: string;
  categoria: string;
  url: string;
  pubblicato: boolean;
}

function toProcedura(r: ProceduraRow): Procedura {
  return {
    id: r.id,
    titolo: r.titolo,
    descrizione: r.descrizione,
    servizio: r.servizio,
    ufficioId: r.ufficio_id,
    ufficioNome: r.ufficio_nome ?? "",
    referente: r.referente,
    referenteContatto: r.referente_contatto,
    categoria: r.categoria,
    url: r.url,
    pubblicato: r.pubblicato,
  };
}

const PROC_COLS =
  "p.id, p.titolo, p.descrizione, p.servizio, p.ufficio_id, u.nome AS ufficio_nome, p.referente, p.referente_contatto, p.categoria, p.url, p.pubblicato";
const PROC_JOIN = "FROM procedure p LEFT JOIN uffici u ON u.id = p.ufficio_id";

// Tutte le procedure, incluse le bozze non pubblicate: uso admin (gestione).
export async function getProcedure(): Promise<Procedura[]> {
  await ensureSchema();
  const { rows } = await pool.query<ProceduraRow>(
    `SELECT ${PROC_COLS} ${PROC_JOIN} ORDER BY p.categoria ASC, p.titolo ASC`
  );
  return rows.map(toProcedura);
}

// Solo le procedure pubblicate: uso sito pubblico.
export async function getProcedurePubblicate(): Promise<Procedura[]> {
  await ensureSchema();
  const { rows } = await pool.query<ProceduraRow>(
    `SELECT ${PROC_COLS} ${PROC_JOIN} WHERE p.pubblicato = true ORDER BY p.categoria ASC, p.titolo ASC`
  );
  return rows.map(toProcedura);
}

export async function getProcedura(id: string): Promise<Procedura | null> {
  await ensureSchema();
  const { rows } = await pool.query<ProceduraRow>(
    `SELECT ${PROC_COLS} ${PROC_JOIN} WHERE p.id = $1`,
    [id]
  );
  return rows[0] ? toProcedura(rows[0]) : null;
}

export interface UpsertProceduraInput {
  id: string;
  titolo: string;
  descrizione: string;
  servizio: string;
  ufficioId: string | null;
  referente: string;
  referenteContatto: string;
  categoria: string;
  url: string;
  pubblicato: boolean;
}

export async function upsertProcedura(p: UpsertProceduraInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO procedure (id, titolo, descrizione, servizio, ufficio_id, referente, referente_contatto, categoria, url, pubblicato)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       titolo = EXCLUDED.titolo, descrizione = EXCLUDED.descrizione, servizio = EXCLUDED.servizio,
       ufficio_id = EXCLUDED.ufficio_id, referente = EXCLUDED.referente,
       referente_contatto = EXCLUDED.referente_contatto, categoria = EXCLUDED.categoria, url = EXCLUDED.url,
       pubblicato = EXCLUDED.pubblicato`,
    [p.id, p.titolo, p.descrizione, p.servizio, p.ufficioId, p.referente, p.referenteContatto, p.categoria, p.url, p.pubblicato]
  );
}

export async function deleteProcedura(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM procedure WHERE id = $1", [id]);
}

export async function getCategorieProcedure(): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ categoria: string }>(
    "SELECT DISTINCT categoria FROM procedure ORDER BY categoria ASC"
  );
  return rows.map((r) => r.categoria);
}

interface FaqRow {
  id: string;
  domanda: string;
  risposta: string;
  categoria: string;
  procedura_id: string | null;
  procedura_titolo: string | null;
  pubblicato: boolean;
}

function toFaq(r: FaqRow): Faq {
  return {
    id: r.id,
    domanda: r.domanda,
    risposta: r.risposta,
    categoria: r.categoria,
    proceduraId: r.procedura_id,
    proceduraTitolo: r.procedura_titolo ?? "",
    pubblicato: r.pubblicato,
  };
}

const FAQ_COLS =
  "f.id, f.domanda, f.risposta, f.categoria, f.procedura_id, p.titolo AS procedura_titolo, f.pubblicato";
const FAQ_JOIN = "FROM faq f LEFT JOIN procedure p ON p.id = f.procedura_id";

// Tutte le FAQ, incluse le bozze non pubblicate: uso admin (gestione).
export async function getFaq(): Promise<Faq[]> {
  await ensureSchema();
  const { rows } = await pool.query<FaqRow>(
    `SELECT ${FAQ_COLS} ${FAQ_JOIN} ORDER BY f.categoria ASC, f.domanda ASC`
  );
  return rows.map(toFaq);
}

// Solo le FAQ pubblicate: uso sito pubblico.
export async function getFaqPubblicate(): Promise<Faq[]> {
  await ensureSchema();
  const { rows } = await pool.query<FaqRow>(
    `SELECT ${FAQ_COLS} ${FAQ_JOIN} WHERE f.pubblicato = true ORDER BY f.categoria ASC, f.domanda ASC`
  );
  return rows.map(toFaq);
}

// FAQ pubblicate collegate a una procedura specifica: uso /procedure/[id].
export async function getFaqByProcedura(proceduraId: string): Promise<Faq[]> {
  await ensureSchema();
  const { rows } = await pool.query<FaqRow>(
    `SELECT ${FAQ_COLS} ${FAQ_JOIN} WHERE f.pubblicato = true AND f.procedura_id = $1 ORDER BY f.domanda ASC`,
    [proceduraId]
  );
  return rows.map(toFaq);
}

export async function getFaqUnica(id: string): Promise<Faq | null> {
  await ensureSchema();
  const { rows } = await pool.query<FaqRow>(
    `SELECT ${FAQ_COLS} ${FAQ_JOIN} WHERE f.id = $1`,
    [id]
  );
  return rows[0] ? toFaq(rows[0]) : null;
}

export interface UpsertFaqInput {
  id: string;
  domanda: string;
  risposta: string;
  categoria: string;
  proceduraId: string | null;
  pubblicato: boolean;
}

export async function upsertFaq(f: UpsertFaqInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO faq (id, domanda, risposta, categoria, procedura_id, pubblicato)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       domanda = EXCLUDED.domanda, risposta = EXCLUDED.risposta, categoria = EXCLUDED.categoria,
       procedura_id = EXCLUDED.procedura_id, pubblicato = EXCLUDED.pubblicato`,
    [f.id, f.domanda, f.risposta, f.categoria, f.proceduraId, f.pubblicato]
  );
}

export async function deleteFaq(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM faq WHERE id = $1", [id]);
}

// ===================== SEGNALAZIONI ====================================
interface SegnalazioneRow {
  id: string;
  testo: string;
  autore: string | null;
  autore_email: string;
  contatto_id: string | null;
  user_id: string | null;
  letta: boolean;
  risposta_testo: string | null;
  risposta_data: string | null;
  risposta_email_inviata_il: string | null;
  creato_il: string;
}

const SEGNALAZIONE_COLS =
  "id, testo, autore, autore_email, contatto_id, user_id, letta, risposta_testo, " +
  "to_char(risposta_data,'YYYY-MM-DD\"T\"HH24:MI') AS risposta_data, " +
  "to_char(risposta_email_inviata_il,'YYYY-MM-DD\"T\"HH24:MI') AS risposta_email_inviata_il, " +
  "to_char(creato_il,'YYYY-MM-DD\"T\"HH24:MI') AS creato_il";

function toSegnalazione(r: SegnalazioneRow): Segnalazione {
  return {
    id: r.id,
    testo: r.testo,
    autore: r.autore,
    autoreEmail: r.autore_email,
    contattoId: r.contatto_id,
    userId: r.user_id,
    letta: r.letta,
    rispostaTesto: r.risposta_testo,
    rispostaData: r.risposta_data,
    rispostaEmailInviataIl: r.risposta_email_inviata_il,
    creatoIl: r.creato_il,
  };
}

export interface CreaSegnalazioneInput {
  testo: string;
  contattoId: string;
  autore: string; // snapshot di rubrica.nome al momento dell'invio
  autoreEmail: string; // snapshot di rubrica.email, può essere ''
  userId: string | null;
}

// Il nominativo (contattoId/autore/autoreEmail) è sempre risolto dal chiamante da un
// contatto reale della rubrica (vedi inviaSegnalazione in (site)/suggerimenti/actions.ts):
// qui non c'è più un "autore" testo libero opzionale.
export async function createSegnalazione(input: CreaSegnalazioneInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO segnalazioni (id, testo, autore, autore_email, contatto_id, user_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [crypto.randomUUID(), input.testo, input.autore, input.autoreEmail, input.contattoId, input.userId]
  );
}

export async function listSegnalazioni(): Promise<Segnalazione[]> {
  await ensureSchema();
  const { rows } = await pool.query<SegnalazioneRow>(
    `SELECT ${SEGNALAZIONE_COLS} FROM segnalazioni ORDER BY creato_il DESC`
  );
  return rows.map(toSegnalazione);
}

export async function getSegnalazione(id: string): Promise<Segnalazione | null> {
  await ensureSchema();
  const { rows } = await pool.query<SegnalazioneRow>(
    `SELECT ${SEGNALAZIONE_COLS} FROM segnalazioni WHERE id = $1`,
    [id]
  );
  return rows[0] ? toSegnalazione(rows[0]) : null;
}

export async function countSegnalazioniNonLette(): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM segnalazioni WHERE letta = false"
  );
  return rows[0].n;
}

export async function markSegnalazioneLetta(id: string, letta: boolean): Promise<void> {
  await ensureSchema();
  await pool.query("UPDATE segnalazioni SET letta = $2 WHERE id = $1", [id, letta]);
}

// Salva la risposta dell'admin (testo + data) e segna la segnalazione come letta.
// Azzera risposta_email_inviata_il: un vecchio "inviata" non è più veritiero se il
// testo della risposta è cambiato (il chiamante, dopo un invio riuscito, la rivalorizza
// con segnaEmailRispostaInviata).
export async function rispondiSegnalazione(id: string, rispostaTesto: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `UPDATE segnalazioni
     SET risposta_testo = $2, risposta_data = now(), risposta_email_inviata_il = NULL, letta = true
     WHERE id = $1`,
    [id, rispostaTesto]
  );
}

export async function segnaEmailRispostaInviata(id: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    "UPDATE segnalazioni SET risposta_email_inviata_il = now() WHERE id = $1",
    [id]
  );
}

export async function deleteSegnalazione(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM segnalazioni WHERE id = $1", [id]);
}

// ===================== PACCHI ("Di chi è?") ============================
interface PaccoRow {
  id: string;
  data_arrivo: string;
  mittente: string;
  descrizione: string;
  foto_file_name: string | null;
  foto_mime: string | null;
  creato_da: string | null;
  rivendicato_da: string | null;
  rivendicato_nome: string | null;
  rivendicato_email: string | null;
  rivendicato_il: string | null;
  creato_il: string;
}

const PACCO_COLS =
  "id, to_char(data_arrivo,'YYYY-MM-DD') AS data_arrivo, mittente, descrizione, " +
  "foto_file_name, foto_mime, creato_da, rivendicato_da, rivendicato_nome, rivendicato_email, " +
  "to_char(rivendicato_il,'YYYY-MM-DD\"T\"HH24:MI') AS rivendicato_il, " +
  "to_char(creato_il,'YYYY-MM-DD\"T\"HH24:MI') AS creato_il";

function toPacco(r: PaccoRow): Pacco {
  return {
    id: r.id,
    dataArrivo: r.data_arrivo,
    mittente: r.mittente,
    descrizione: r.descrizione,
    hasFoto: !!r.foto_file_name,
    creatoDa: r.creato_da,
    rivendicatoDa: r.rivendicato_da,
    rivendicatoNome: r.rivendicato_nome,
    rivendicatoEmail: r.rivendicato_email,
    rivendicatoIl: r.rivendicato_il,
    creatoIl: r.creato_il,
  };
}

export interface CreaPaccoInput {
  dataArrivo: string;
  mittente: string;
  descrizione: string;
  fotoFileName: string | null;
  fotoMime: string | null;
  creatoDa: string | null;
}

export async function createPacco(input: CreaPaccoInput): Promise<string> {
  await ensureSchema();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO pacchi (id, data_arrivo, mittente, descrizione, foto_file_name, foto_mime, creato_da)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.dataArrivo, input.mittente, input.descrizione, input.fotoFileName, input.fotoMime, input.creatoDa]
  );
  return id;
}

export async function listPacchi(): Promise<Pacco[]> {
  await ensureSchema();
  const { rows } = await pool.query<PaccoRow>(
    `SELECT ${PACCO_COLS} FROM pacchi ORDER BY creato_il DESC`
  );
  return rows.map(toPacco);
}

// Solo i pacchi ancora senza destinatario: è l'elenco che alimenta sia il
// widget in home sia il badge nel menu admin. Più vecchi per primi, così chi
// aspetta un pacco da più tempo compare in cima.
export async function listPacchiInAttesa(): Promise<Pacco[]> {
  await ensureSchema();
  const { rows } = await pool.query<PaccoRow>(
    `SELECT ${PACCO_COLS} FROM pacchi WHERE rivendicato_il IS NULL ORDER BY creato_il ASC`
  );
  return rows.map(toPacco);
}

export async function countPacchiInAttesa(): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM pacchi WHERE rivendicato_il IS NULL"
  );
  return rows[0].n;
}

export async function getPacco(id: string): Promise<Pacco | null> {
  await ensureSchema();
  const { rows } = await pool.query<PaccoRow>(
    `SELECT ${PACCO_COLS} FROM pacchi WHERE id = $1`,
    [id]
  );
  return rows[0] ? toPacco(rows[0]) : null;
}

export async function getFotoPacco(
  id: string
): Promise<{ fileName: string; mime: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ foto_file_name: string | null; foto_mime: string | null }>(
    "SELECT foto_file_name, foto_mime FROM pacchi WHERE id = $1",
    [id]
  );
  const r = rows[0];
  if (!r || !r.foto_file_name) return null;
  return { fileName: r.foto_file_name, mime: r.foto_mime || "application/octet-stream" };
}

// Registra chi ha dichiarato che il pacco è suo. La condizione rivendicato_il IS
// NULL nella WHERE rende l'operazione sicura in caso di doppio invio quasi
// simultaneo (due persone cliccano "è mio" sullo stesso pacco): solo la prima
// UPDATE ha effetto, la seconda tocca 0 righe — il chiamante (rivendicaPaccoAction
// in (site)/di-chi-e/[id]/actions.ts) verifica rowCount per mostrare "già
// assegnato a qualcun altro" invece di sovrascrivere silenziosamente.
export async function rivendicaPacco(
  id: string,
  contatto: { id: string; nome: string; email: string }
): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await pool.query(
    `UPDATE pacchi SET rivendicato_da = $2, rivendicato_nome = $3, rivendicato_email = $4, rivendicato_il = now()
     WHERE id = $1 AND rivendicato_il IS NULL`,
    [id, contatto.id, contatto.nome, contatto.email]
  );
  return (rowCount ?? 0) > 0;
}

export async function deletePacco(id: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ foto_file_name: string | null }>(
    "DELETE FROM pacchi WHERE id = $1 RETURNING foto_file_name",
    [id]
  );
  return rows[0]?.foto_file_name ?? null;
}

// ===================== RICERCA =========================================
// Ricerca globale: interroga tutte le sezioni pubbliche del sito (stesso
// elenco di NAV_ITEMS in lib/routes.ts), non solo un sottoinsieme. Rispetta
// gli stessi filtri di visibilità delle rispettive pagine (es. pubblicato)
// così da non far apparire in ricerca contenuti ancora in bozza.
export async function cerca(q: string): Promise<RisultatoRicerca[]> {
  await ensureSchema();
  const term = `%${q}%`;
  const risultati: RisultatoRicerca[] = [];

  const com = await pool.query<{ id: string; titolo: string; categoria: string; tipo_label: string }>(
    `SELECT id, titolo, categoria,
       CASE tipo
         WHEN 'ufficiale' THEN 'Comunicazione ufficiale'
         WHEN 'rsu' THEN 'Comunicazione RSU'
         WHEN 'sicurezza' THEN 'Comunicazione sicurezza sul lavoro'
         WHEN 'eventi' THEN 'Comunicazione eventi'
         ELSE 'Comunicazione non ufficiale'
       END AS tipo_label
     FROM comunicazioni
     WHERE titolo ILIKE $1 OR estratto ILIKE $1 OR corpo ILIKE $1
        OR categoria ILIKE $1 OR autore ILIKE $1
     ORDER BY data DESC LIMIT 25`,
    [term]
  );
  for (const c of com.rows) {
    risultati.push({
      tipo: "Comunicazione",
      titolo: c.titolo,
      sottotitolo: `${c.tipo_label} · ${c.categoria}`,
      href: `/comunicazioni/${c.id}`,
    });
  }

  const serv = await pool.query<{ id: string; nome: string; categoria: string; url: string }>(
    "SELECT id, nome, categoria, url FROM servizi WHERE nome ILIKE $1 OR descrizione ILIKE $1 OR categoria ILIKE $1 ORDER BY nome LIMIT 25",
    [term]
  );
  for (const s of serv.rows) {
    risultati.push({
      tipo: "Servizio",
      titolo: s.nome,
      sottotitolo: s.categoria ? `Servizio · ${s.categoria}` : "Servizio",
      href: s.url || "/dashboard-servizi",
    });
  }

  const port = await pool.query<{ id: string; nome: string; categoria: string; url: string }>(
    "SELECT id, nome, categoria, url FROM portali WHERE nome ILIKE $1 OR descrizione ILIKE $1 OR categoria ILIKE $1 ORDER BY nome LIMIT 25",
    [term]
  );
  for (const p of port.rows) {
    risultati.push({
      tipo: "Portale",
      titolo: p.nome,
      sottotitolo: p.categoria ? `Portale · ${p.categoria}` : "Portale",
      href: p.url || "/dashboard-portali",
    });
  }

  // Oltre al titolo, matcha anche il testo estratto dal PDF (stesso indice
  // full-text usato dalla ricerca dedicata in /regolamenti). Il match sul solo
  // stem (testo_tsv) richiede anche il riscontro letterale nel testo, per
  // evitare falsi positivi da stemming (es. "Marco" ~ "marchio"/"marcia").
  const reg = await pool.query<{ id: string; titolo: string; sottotitolo: string }>(
    `SELECT id, titolo,
       CASE WHEN titolo ILIKE $1 THEN 'Regolamento' ELSE 'Regolamento · corrisponde nel testo' END AS sottotitolo
     FROM regolamenti
     WHERE titolo ILIKE $1
        OR (testo_tsv @@ plainto_tsquery('italian', $2) AND (titolo || ' ' || testo) ILIKE $1)
     ORDER BY titolo LIMIT 25`,
    [term, q]
  );
  for (const r of reg.rows) {
    risultati.push({ tipo: "Regolamento", titolo: r.titolo, sottotitolo: r.sottotitolo, href: `/regolamenti/${r.id}` });
  }

  const carta = await pool.query<{ id: string; titolo: string }>(
    "SELECT id, titolo FROM carta_intestata WHERE titolo ILIKE $1 ORDER BY titolo LIMIT 25",
    [term]
  );
  for (const c of carta.rows) {
    risultati.push({
      tipo: "Carta intestata",
      titolo: c.titolo,
      sottotitolo: "Carta intestata",
      href: `/api/carta-intestata/${c.id}`,
    });
  }

  const gui = await pool.query<{ id: string; titolo: string; categoria: string }>(
    "SELECT id, titolo, categoria FROM guide WHERE titolo ILIKE $1 OR descrizione ILIKE $1 OR categoria ILIKE $1 ORDER BY titolo LIMIT 25",
    [term]
  );
  for (const g of gui.rows) {
    risultati.push({
      tipo: "Formazione",
      titolo: g.titolo,
      sottotitolo: `Formazione dei colleghi · ${g.categoria}`,
      href: `/formazione/colleghi-per-colleghi/${g.id}`,
    });
  }

  const avvisiForm = await pool.query<{ id: string; titolo: string }>(
    "SELECT id, titolo FROM formazione_avvisi WHERE titolo ILIKE $1 OR descrizione ILIKE $1 ORDER BY creato_il DESC LIMIT 25",
    [term]
  );
  for (const a of avvisiForm.rows) {
    risultati.push({
      tipo: "Formazione",
      titolo: a.titolo,
      sottotitolo: "Avvisi e opportunità formative",
      href: "/formazione/avvisi",
    });
  }

  const cont = await pool.query<{
    id: string;
    nome: string;
    uffici_nomi: string | null;
    interno: string;
    match_persona: boolean;
  }>(
    `SELECT r.id, r.nome, r.interno,
       (r.nome ILIKE $1 OR r.email ILIKE $1 OR r.interno ILIKE $1) AS match_persona,
       (SELECT string_agg(u.nome, ', ' ORDER BY u.nome)
        FROM rubrica_uffici ru JOIN uffici u ON u.id = ru.ufficio_id
        WHERE ru.contatto_id = r.id) AS uffici_nomi
     FROM rubrica r
     WHERE r.nome ILIKE $1 OR r.ruolo ILIKE $1 OR r.interno ILIKE $1 OR r.email ILIKE $1
        OR EXISTS (
          SELECT 1 FROM rubrica_uffici ru JOIN uffici u ON u.id = ru.ufficio_id
          WHERE ru.contatto_id = r.id AND u.nome ILIKE $1
        )
     ORDER BY r.nome LIMIT 25`,
    [term]
  );
  // Presenza/assenza/smartworking di oggi: mostrata insieme al risultato in
  // rubrica, così la ricerca di un nominativo risponde subito anche a "è in ufficio?".
  const statoOggi = cont.rows.length > 0
    ? new Map((await getStatoPresenzeInData(oggiIso())).map((s) => [s.id, s.tipo]))
    : new Map<string, StatoPresenza>();
  // Chi corrisponde come persona (nome, email o interno) va in testa a tutti i
  // risultati: cercare un nominativo deve rispondere prima di tutto con la
  // persona in rubrica. Gli altri contatti (match sul ruolo o sull'ufficio)
  // restano nella posizione consueta, dopo le altre sezioni.
  const persone: RisultatoRicerca[] = [];
  for (const c of cont.rows) {
    const dettaglio = [c.uffici_nomi, c.interno && `int. ${c.interno}`].filter(Boolean).join(" · ");
    const risultato: RisultatoRicerca = {
      tipo: "Contatto",
      titolo: c.nome,
      sottotitolo: dettaglio ? `Rubrica · ${dettaglio}` : "Rubrica",
      href: "/rubrica",
      presenza: statoOggi.get(c.id) ?? "presente",
    };
    if (c.match_persona) persone.push(risultato);
    else risultati.push(risultato);
  }
  risultati.unshift(...persone);

  const proc = await pool.query<{ id: string; titolo: string; servizio: string; ufficio_nome: string | null }>(
    `SELECT p.id, p.titolo, p.servizio, u.nome AS ufficio_nome FROM procedure p
     LEFT JOIN uffici u ON u.id = p.ufficio_id
     WHERE p.pubblicato = true
       AND (p.titolo ILIKE $1 OR p.descrizione ILIKE $1 OR p.servizio ILIKE $1
        OR u.nome ILIKE $1 OR p.referente ILIKE $1 OR p.categoria ILIKE $1)
     ORDER BY p.titolo LIMIT 25`,
    [term]
  );
  for (const p of proc.rows) {
    const dettaglio = [p.servizio, p.ufficio_nome].filter(Boolean).join(" · ");
    risultati.push({
      tipo: "Procedura",
      titolo: p.titolo,
      sottotitolo: dettaglio ? `Procedura · ${dettaglio}` : "Procedura",
      href: `/procedure/${p.id}`,
    });
  }

  const faqRes = await pool.query<{ id: string; domanda: string; categoria: string; procedura_id: string | null }>(
    `SELECT f.id, f.domanda, f.categoria, f.procedura_id FROM faq f
     WHERE f.pubblicato = true
       AND (f.domanda ILIKE $1 OR f.risposta ILIKE $1 OR f.categoria ILIKE $1)
     ORDER BY f.domanda LIMIT 25`,
    [term]
  );
  for (const f of faqRes.rows) {
    risultati.push({
      tipo: "FAQ",
      titolo: f.domanda,
      sottotitolo: `FAQ · ${f.categoria}`,
      href: f.procedura_id ? `/procedure/${f.procedura_id}` : "/faq",
    });
  }

  // Solo moduli pubblicati: stessa visibilità della pagina pubblica /moduli.
  const mod = await pool.query<{ id: string; titolo: string; ufficio_nome: string }>(
    `SELECT m.id, m.titolo, u.nome AS ufficio_nome FROM moduli m
     JOIN uffici u ON u.id = m.ufficio_id
     WHERE m.pubblicato = true
       AND (m.titolo ILIKE $1 OR m.descrizione ILIKE $1 OR u.nome ILIKE $1)
     ORDER BY m.titolo LIMIT 25`,
    [term]
  );
  for (const m of mod.rows) {
    risultati.push({
      tipo: "Modulo",
      titolo: m.titolo,
      sottotitolo: `Modulo · ${m.ufficio_nome}`,
      href: `/moduli/${m.id}`,
    });
  }

  // Solo sondaggi pubblicati: stessa visibilità della pagina pubblica /sondaggi.
  const sond = await pool.query<{ id: string; titolo: string }>(
    `SELECT id, titolo FROM sondaggi
     WHERE pubblicato = true AND (titolo ILIKE $1 OR descrizione ILIKE $1)
     ORDER BY titolo LIMIT 25`,
    [term]
  );
  for (const s of sond.rows) {
    risultati.push({
      tipo: "Sondaggio",
      titolo: s.titolo,
      sottotitolo: "Sondaggio",
      href: `/sondaggi/${s.id}`,
    });
  }

  const all = await pool.query<{ id: string; etichetta: string; tipo: string; url: string | null }>(
    "SELECT id, etichetta, tipo, url FROM allegati WHERE etichetta ILIKE $1 ORDER BY etichetta LIMIT 25",
    [term]
  );
  for (const a of all.rows) {
    risultati.push({
      tipo: "Documento",
      titolo: a.etichetta,
      sottotitolo: "Allegato a una comunicazione",
      href: a.tipo === "file" ? `/api/file/${a.id}` : a.url ?? "#",
    });
  }

  return risultati;
}

// ===================== UFFICI ==========================================
// Gerarchia canonica Area -> Settore -> Ufficio (diversa dal testo libero
// storico già in rubrica/procedure): serve per il matching esatto dei
// permessi editor e per la selezione a qualunque livello nella UI.
interface UfficioRow {
  id: string;
  nome: string;
  livello: string;
  parent_id: string | null;
}

function toUfficio(r: UfficioRow): Ufficio {
  return { id: r.id, nome: r.nome, livello: r.livello as LivelloUfficio, parentId: r.parent_id };
}

export async function listUffici(): Promise<Ufficio[]> {
  await ensureSchema();
  const { rows } = await pool.query<UfficioRow>(
    "SELECT id, nome, livello, parent_id FROM uffici ORDER BY nome ASC"
  );
  return rows.map(toUfficio);
}

// Responsabili dei nodi indicati (tabella uffici_responsabili, molti-a-molti).
// Batch-fetch come getUfficiPerContatti: /admin/uffici carica l'intero albero in
// una volta sola, mai un nodo per query. La chiave della mappa è l'ufficio; i
// nodi senza responsabili proprii semplicemente non compaiono.
export async function getResponsabiliPerUffici(
  ufficioIds: string[]
): Promise<Map<string, ResponsabileUfficio[]>> {
  const map = new Map<string, ResponsabileUfficio[]>();
  if (ufficioIds.length === 0) return map;
  await ensureSchema();
  const { rows } = await pool.query<{ ufficio_id: string; id: string; nome: string }>(
    `SELECT ur.ufficio_id, r.id, r.nome
     FROM uffici_responsabili ur JOIN rubrica r ON r.id = ur.contatto_id
     WHERE ur.ufficio_id = ANY($1)
     ORDER BY r.nome ASC`,
    [ufficioIds]
  );
  for (const r of rows) {
    const list = map.get(r.ufficio_id) ?? [];
    list.push({ id: r.id, nome: r.nome });
    map.set(r.ufficio_id, list);
  }
  return map;
}

// Sostituisce l'insieme dei responsabili di un nodo (delete + insert in
// transazione), stesso schema di setUfficiContatto.
export async function setResponsabiliUfficio(
  ufficioId: string,
  contattoIds: string[]
): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM uffici_responsabili WHERE ufficio_id = $1", [ufficioId]);
    for (const contattoId of contattoIds) {
      await client.query(
        "INSERT INTO uffici_responsabili (ufficio_id, contatto_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [ufficioId, contattoId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Uffici che hanno pubblicato almeno una comunicazione ufficiale, per il
// sottomenu "Comunicazioni Ufficiali" in sidebar. comunicazioni.categoria è il
// nome testuale dell'ufficio scelto in admin (non una FK, vedi
// ComunicazioneCampiPrincipali), quindi il match è per uguaglianza di nome.
export async function getUfficiConComunicazioniUfficiali(): Promise<Ufficio[]> {
  await ensureSchema();
  const [{ rows }, tutti] = await Promise.all([
    pool.query<{ categoria: string }>(
      "SELECT DISTINCT categoria FROM comunicazioni WHERE tipo = 'ufficiale'"
    ),
    listUffici(),
  ]);
  const nomi = new Set(rows.map((r) => r.categoria));
  return tutti
    .filter((u) => nomi.has(u.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export interface UpsertUnitaInput {
  id?: string;
  nome: string;
  livello: LivelloUfficio;
  parentId: string | null;
}

// Crea un nodo (Area/Settore/Ufficio) o rinomina/ri-assegna il genitore di uno
// esistente. `livello` non è modificabile su un nodo esistente (evita di
// rompere la coerenza dell'albero da un form generico): in aggiornamento viene
// ignorato, conta solo in creazione.
export async function upsertUnita(input: UpsertUnitaInput): Promise<void> {
  await ensureSchema();
  if (input.id) {
    await pool.query("UPDATE uffici SET nome = $2, parent_id = $3 WHERE id = $1", [
      input.id,
      input.nome,
      input.parentId,
    ]);
  } else {
    await pool.query(
      "INSERT INTO uffici (id, nome, livello, parent_id) VALUES ($1,$2,$3,$4) ON CONFLICT (nome) DO NOTHING",
      [crypto.randomUUID(), input.nome, input.livello, input.parentId]
    );
  }
}

export type EsitoEliminaUnita =
  | "ok"
  | "ha_figli"
  | "in_uso_moduli"
  | "in_uso_rubrica"
  | "in_uso_procedure";

// Blocca la cancellazione se il nodo ha figli o è ancora referenziato, invece
// di affidarsi al vincolo FK (ON DELETE RESTRICT resta comunque come rete di sicurezza).
export async function deleteUnita(id: string): Promise<EsitoEliminaUnita> {
  await ensureSchema();
  const { rows: f } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM uffici WHERE parent_id = $1",
    [id]
  );
  if (f[0].n > 0) return "ha_figli";
  const { rows: m } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM moduli WHERE ufficio_id = $1",
    [id]
  );
  if (m[0].n > 0) return "in_uso_moduli";
  const { rows: r } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM rubrica_uffici WHERE ufficio_id = $1",
    [id]
  );
  if (r[0].n > 0) return "in_uso_rubrica";
  const { rows: p } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM procedure WHERE ufficio_id = $1",
    [id]
  );
  if (p[0].n > 0) return "in_uso_procedure";
  await pool.query("DELETE FROM uffici WHERE id = $1", [id]);
  return "ok";
}

// ===================== MODULI ==========================================
interface ModuloRow {
  id: string;
  titolo: string;
  descrizione: string;
  ufficio_id: string;
  ufficio_nome: string;
  pubblicato: boolean;
  tipo: string;
  email_notifica: string;
  pdf_destinatario: string;
  pdf_destinatario_pc: string;
  pdf_corpo: string;
  pdf_nota: string;
  creato_da: string | null;
}

interface ModuloCampoRow {
  id: string;
  modulo_id: string;
  etichetta: string;
  tipo: string;
  opzioni: string | null;
  obbligatorio: boolean;
}

function toModuloCampo(r: ModuloCampoRow): ModuloCampo {
  return {
    id: r.id,
    moduloId: r.modulo_id,
    etichetta: r.etichetta,
    tipo: r.tipo as TipoCampoModulo,
    opzioni: r.opzioni
      ? r.opzioni.split("\n").map((s) => s.trim()).filter(Boolean)
      : [],
    obbligatorio: r.obbligatorio,
  };
}

function toModulo(r: ModuloRow, campi: ModuloCampo[] = [], allegati: Allegato[] = []): Modulo {
  return {
    id: r.id,
    titolo: r.titolo,
    descrizione: r.descrizione,
    ufficioId: r.ufficio_id,
    ufficioNome: r.ufficio_nome,
    pubblicato: r.pubblicato,
    tipo: r.tipo as TipoModulo,
    emailNotifica: r.email_notifica,
    pdfDestinatario: r.pdf_destinatario,
    pdfDestinatarioPc: r.pdf_destinatario_pc,
    pdfCorpo: r.pdf_corpo,
    pdfNota: r.pdf_nota,
    campi,
    allegati,
    creatoDa: r.creato_da,
  };
}

const MODULO_COLS =
  "m.id, m.titolo, m.descrizione, m.ufficio_id, u.nome AS ufficio_nome, m.pubblicato, m.tipo, m.email_notifica, m.pdf_destinatario, m.pdf_destinatario_pc, m.pdf_corpo, m.pdf_nota, m.creato_da";

async function getCampiPerModuli(ids: string[]): Promise<Map<string, ModuloCampo[]>> {
  const map = new Map<string, ModuloCampo[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<ModuloCampoRow>(
    `SELECT id, modulo_id, etichetta, tipo, opzioni, obbligatorio
     FROM moduli_campi WHERE modulo_id = ANY($1) ORDER BY ordine ASC NULLS LAST, creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const c = toModuloCampo(r);
    const list = map.get(r.modulo_id) ?? [];
    list.push(c);
    map.set(r.modulo_id, list);
  }
  return map;
}

interface AllegatoModuloRow {
  id: string;
  modulo_id: string;
  tipo: string;
  etichetta: string;
  url: string | null;
  file_name: string | null;
  mime: string | null;
}

function toAllegatoModulo(r: AllegatoModuloRow): Allegato {
  return {
    id: r.id,
    moduloId: r.modulo_id,
    tipo: r.tipo as TipoAllegato,
    etichetta: r.etichetta,
    url: r.tipo === "file" ? `/api/moduli-allegato/${r.id}` : r.url ?? "",
  };
}

async function getAllegatiPerModuli(ids: string[]): Promise<Map<string, Allegato[]>> {
  const map = new Map<string, Allegato[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<AllegatoModuloRow>(
    `SELECT id, modulo_id, tipo, etichetta, url, file_name, mime
     FROM moduli_allegati WHERE modulo_id = ANY($1) ORDER BY creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const a = toAllegatoModulo(r);
    const list = map.get(r.modulo_id) ?? [];
    list.push(a);
    map.set(r.modulo_id, list);
  }
  return map;
}

// Dati grezzi del file (per la rotta di download /api/moduli-allegato/<id>).
export async function getAllegatoModuloFile(
  id: string
): Promise<{ fileName: string; mime: string; etichetta: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<AllegatoModuloRow>(
    "SELECT id, modulo_id, tipo, etichetta, url, file_name, mime FROM moduli_allegati WHERE id = $1 AND tipo = 'file'",
    [id]
  );
  const r = rows[0];
  if (!r || !r.file_name) return null;
  return { fileName: r.file_name, mime: r.mime ?? "application/octet-stream", etichetta: r.etichetta };
}

export async function addAllegatoModuloLink(
  moduloId: string,
  etichetta: string,
  url: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO moduli_allegati (id, modulo_id, tipo, etichetta, url)
     VALUES ($1,$2,'link',$3,$4)`,
    [crypto.randomUUID(), moduloId, etichetta || url, url]
  );
}

export async function addAllegatoModuloFile(
  moduloId: string,
  etichetta: string,
  fileName: string,
  mime: string
): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO moduli_allegati (id, modulo_id, tipo, etichetta, file_name, mime)
     VALUES ($1,$2,'file',$3,$4,$5)`,
    [crypto.randomUUID(), moduloId, etichetta, fileName, mime]
  );
}

// Rimuove la riga allegato e restituisce il file_name (se file) per cancellare il file su disco.
// Vincolata al modulo su cui il chiamante ha verificato il permesso, come deleteAllegato.
export async function deleteAllegatoModulo(id: string, moduloId: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string | null }>(
    "DELETE FROM moduli_allegati WHERE id = $1 AND modulo_id = $2 RETURNING file_name",
    [id, moduloId]
  );
  return rows[0]?.file_name ?? null;
}

export async function getModuliPubblicati(): Promise<Modulo[]> {
  await ensureSchema();
  const { rows } = await pool.query<ModuloRow>(
    `SELECT ${MODULO_COLS} FROM moduli m JOIN uffici u ON u.id = m.ufficio_id
     WHERE m.pubblicato = true ORDER BY u.nome ASC, m.titolo ASC`
  );
  const ids = rows.map((r) => r.id);
  const [campi, allegati] = await Promise.all([getCampiPerModuli(ids), getAllegatiPerModuli(ids)]);
  return rows.map((r) => toModulo(r, campi.get(r.id) ?? [], allegati.get(r.id) ?? []));
}

// ufficioIds: null = amministratore (nessun filtro), [] = editor senza uffici (nessun risultato).
export async function getModuliPerUffici(ufficioIds: string[] | null): Promise<Modulo[]> {
  await ensureSchema();
  const { rows } = ufficioIds
    ? await pool.query<ModuloRow>(
        `SELECT ${MODULO_COLS} FROM moduli m JOIN uffici u ON u.id = m.ufficio_id
         WHERE m.ufficio_id = ANY($1) ORDER BY u.nome ASC, m.titolo ASC`,
        [ufficioIds]
      )
    : await pool.query<ModuloRow>(
        `SELECT ${MODULO_COLS} FROM moduli m JOIN uffici u ON u.id = m.ufficio_id
         ORDER BY u.nome ASC, m.titolo ASC`
      );
  const ids = rows.map((r) => r.id);
  const [campi, allegati] = await Promise.all([getCampiPerModuli(ids), getAllegatiPerModuli(ids)]);
  return rows.map((r) => toModulo(r, campi.get(r.id) ?? [], allegati.get(r.id) ?? []));
}

export async function getModulo(id: string): Promise<Modulo | null> {
  await ensureSchema();
  const { rows } = await pool.query<ModuloRow>(
    `SELECT ${MODULO_COLS} FROM moduli m JOIN uffici u ON u.id = m.ufficio_id WHERE m.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const [campi, allegati] = await Promise.all([getCampiPerModuli([id]), getAllegatiPerModuli([id])]);
  return toModulo(rows[0], campi.get(id) ?? [], allegati.get(id) ?? []);
}

export interface UpsertModuloInput {
  id?: string;
  titolo: string;
  descrizione: string;
  ufficioId: string;
  pubblicato: boolean;
  tipo: TipoModulo;
  emailNotifica: string;
  pdfDestinatario: string;
  pdfDestinatarioPc: string;
  pdfCorpo: string;
  pdfNota: string;
  // Scritto solo in INSERT (vedi saveModuloConCampi): il chiamante lo valorizza
  // con l'utente che crea il modulo, ininfluente in modifica (il proprietario
  // originale non cambia mai).
  creatoDa: string | null;
}

export interface CampoModuloInput {
  id: string;
  etichetta: string;
  tipo: TipoCampoModulo;
  opzioni: string[];
  obbligatorio: boolean;
}

// Salva in una singola transazione il modulo (titolo/descrizione/ufficio/
// pubblicato) e l'intero elenco domande, così l'editor "una pagina sola"
// stile Google Moduli può creare/modificare tutto con un solo Salva. I campi
// vengono fatti upsert per id (l'editor genera gli id lato client per le
// domande nuove) e quelli non più presenti nella lista vengono eliminati:
// questo preserva il legame con le risposte già ricevute per i campi che
// restano, invece di ricreare sempre tutto da zero.
export async function saveModuloConCampi(
  input: UpsertModuloInput,
  campi: CampoModuloInput[]
): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // creato_da assente dalla SET dell'UPDATE: una modifica successiva non può
    // mai cambiare il proprietario originale (stesso principio di
    // upsertComunicazione sopra).
    await client.query(
      `INSERT INTO moduli (id, titolo, descrizione, ufficio_id, pubblicato, tipo, email_notifica, pdf_destinatario, pdf_destinatario_pc, pdf_corpo, pdf_nota, creato_da)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         titolo = EXCLUDED.titolo, descrizione = EXCLUDED.descrizione,
         ufficio_id = EXCLUDED.ufficio_id, pubblicato = EXCLUDED.pubblicato,
         tipo = EXCLUDED.tipo, email_notifica = EXCLUDED.email_notifica,
         pdf_destinatario = EXCLUDED.pdf_destinatario, pdf_destinatario_pc = EXCLUDED.pdf_destinatario_pc,
         pdf_corpo = EXCLUDED.pdf_corpo, pdf_nota = EXCLUDED.pdf_nota`,
      [
        id, input.titolo, input.descrizione, input.ufficioId, input.pubblicato, input.tipo, input.emailNotifica,
        input.pdfDestinatario, input.pdfDestinatarioPc, input.pdfCorpo, input.pdfNota, input.creatoDa,
      ]
    );

    const ids = campi.map((c) => c.id);
    await client.query(
      ids.length > 0
        ? "DELETE FROM moduli_campi WHERE modulo_id = $1 AND NOT (id = ANY($2))"
        : "DELETE FROM moduli_campi WHERE modulo_id = $1",
      ids.length > 0 ? [id, ids] : [id]
    );
    for (let i = 0; i < campi.length; i++) {
      const c = campi[i];
      await client.query(
        `INSERT INTO moduli_campi (id, modulo_id, etichetta, tipo, opzioni, obbligatorio, ordine)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           etichetta = EXCLUDED.etichetta, tipo = EXCLUDED.tipo,
           opzioni = EXCLUDED.opzioni, obbligatorio = EXCLUDED.obbligatorio,
           ordine = EXCLUDED.ordine`,
        [
          c.id,
          id,
          c.etichetta,
          c.tipo,
          c.opzioni.length > 0 ? c.opzioni.join("\n") : null,
          c.obbligatorio,
          i,
        ]
      );
    }
    await client.query("COMMIT");
    return id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Colleziona i file_name degli allegati raggiungibili (prima del cascade delete),
// così il chiamante può ripulirli da disco con deleteUpload.
export async function deleteModulo(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows: risposte } = await pool.query<{ file_name: string }>(
    `SELECT a.file_name FROM moduli_compilazioni_allegati a
     JOIN moduli_compilazioni c ON c.id = a.compilazione_id
     WHERE c.modulo_id = $1`,
    [id]
  );
  const { rows: allegati } = await pool.query<{ file_name: string | null }>(
    "SELECT file_name FROM moduli_allegati WHERE modulo_id = $1 AND file_name IS NOT NULL",
    [id]
  );
  await pool.query("DELETE FROM moduli WHERE id = $1", [id]);
  return [
    ...risposte.map((r) => r.file_name),
    ...allegati.map((r) => r.file_name).filter((f): f is string => Boolean(f)),
  ];
}

// ===================== SONDAGGI (solo amministratore) ==================
// Stessa forma di Moduli (stesso editor "una pagina sola" stile Google Moduli,
// stesso set di tipi/opzioni in TipoCampoModulo), ma senza ufficio/allegati/
// notifiche email: per ora la sezione è riservata al ruolo admin (vedi
// requireAdmin() nelle azioni saveSondaggio/removeSondaggio in admin/actions.ts),
// nessuna pagina pubblica di compilazione.
interface SondaggioRow {
  id: string;
  titolo: string;
  descrizione: string;
  pubblicato: boolean;
  creato_da: string | null;
}

interface SondaggioCampoRow {
  id: string;
  sondaggio_id: string;
  etichetta: string;
  tipo: string;
  opzioni: string | null;
  obbligatorio: boolean;
}

function toSondaggioCampo(r: SondaggioCampoRow): SondaggioCampo {
  return {
    id: r.id,
    sondaggioId: r.sondaggio_id,
    etichetta: r.etichetta,
    tipo: r.tipo as TipoCampoModulo,
    opzioni: r.opzioni ? r.opzioni.split("\n").map((s) => s.trim()).filter(Boolean) : [],
    obbligatorio: r.obbligatorio,
  };
}

function toSondaggio(r: SondaggioRow, campi: SondaggioCampo[] = []): Sondaggio {
  return {
    id: r.id,
    titolo: r.titolo,
    descrizione: r.descrizione,
    pubblicato: r.pubblicato,
    campi,
    creatoDa: r.creato_da,
  };
}

const SONDAGGIO_COLS = "id, titolo, descrizione, pubblicato, creato_da";

async function getCampiPerSondaggi(ids: string[]): Promise<Map<string, SondaggioCampo[]>> {
  const map = new Map<string, SondaggioCampo[]>();
  if (ids.length === 0) return map;
  const { rows } = await pool.query<SondaggioCampoRow>(
    `SELECT id, sondaggio_id, etichetta, tipo, opzioni, obbligatorio
     FROM sondaggi_campi WHERE sondaggio_id = ANY($1) ORDER BY ordine ASC NULLS LAST, creato_il ASC`,
    [ids]
  );
  for (const r of rows) {
    const c = toSondaggioCampo(r);
    const list = map.get(r.sondaggio_id) ?? [];
    list.push(c);
    map.set(r.sondaggio_id, list);
  }
  return map;
}

// Tutti i sondaggi: nessun filtro per ufficio/permessi, la pagina che la chiama
// è già dietro requireAdmin().
export async function getSondaggi(): Promise<Sondaggio[]> {
  await ensureSchema();
  const { rows } = await pool.query<SondaggioRow>(
    `SELECT ${SONDAGGIO_COLS} FROM sondaggi ORDER BY creato_il DESC`
  );
  const campi = await getCampiPerSondaggi(rows.map((r) => r.id));
  return rows.map((r) => toSondaggio(r, campi.get(r.id) ?? []));
}

export async function getSondaggio(id: string): Promise<Sondaggio | null> {
  await ensureSchema();
  const { rows } = await pool.query<SondaggioRow>(
    `SELECT ${SONDAGGIO_COLS} FROM sondaggi WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const campi = await getCampiPerSondaggi([id]);
  return toSondaggio(rows[0], campi.get(id) ?? []);
}

// Solo i sondaggi pubblicati: uso sito pubblico (/sondaggi).
export async function getSondaggiPubblicati(): Promise<Sondaggio[]> {
  await ensureSchema();
  const { rows } = await pool.query<SondaggioRow>(
    `SELECT ${SONDAGGIO_COLS} FROM sondaggi WHERE pubblicato = true ORDER BY creato_il DESC`
  );
  const campi = await getCampiPerSondaggi(rows.map((r) => r.id));
  return rows.map((r) => toSondaggio(r, campi.get(r.id) ?? []));
}

export interface UpsertSondaggioInput {
  id?: string;
  titolo: string;
  descrizione: string;
  pubblicato: boolean;
  // Scritto solo in INSERT (vedi saveSondaggioConCampi): il chiamante lo valorizza
  // con l'utente che crea il sondaggio, ininfluente in modifica (il proprietario
  // originale non cambia mai).
  creatoDa: string | null;
}

export interface CampoSondaggioInput {
  id: string;
  etichetta: string;
  tipo: TipoCampoModulo;
  opzioni: string[];
  obbligatorio: boolean;
}

// Salva in una singola transazione il sondaggio (titolo/descrizione/pubblicato)
// e l'intero elenco domande, stesso pattern "una pagina sola" di
// saveModuloConCampi sopra: upsert dei campi per id, elimina quelli non più
// presenti nella lista.
export async function saveSondaggioConCampi(
  input: UpsertSondaggioInput,
  campi: CampoSondaggioInput[]
): Promise<string> {
  await ensureSchema();
  const id = input.id || crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // creato_da assente dalla SET dell'UPDATE: una modifica successiva non può
    // mai cambiare il proprietario originale (stesso principio di
    // upsertComunicazione/saveModuloConCampi sopra).
    await client.query(
      `INSERT INTO sondaggi (id, titolo, descrizione, pubblicato, creato_da)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         titolo = EXCLUDED.titolo, descrizione = EXCLUDED.descrizione, pubblicato = EXCLUDED.pubblicato`,
      [id, input.titolo, input.descrizione, input.pubblicato, input.creatoDa]
    );

    const ids = campi.map((c) => c.id);
    await client.query(
      ids.length > 0
        ? "DELETE FROM sondaggi_campi WHERE sondaggio_id = $1 AND NOT (id = ANY($2))"
        : "DELETE FROM sondaggi_campi WHERE sondaggio_id = $1",
      ids.length > 0 ? [id, ids] : [id]
    );
    for (let i = 0; i < campi.length; i++) {
      const c = campi[i];
      await client.query(
        `INSERT INTO sondaggi_campi (id, sondaggio_id, etichetta, tipo, opzioni, obbligatorio, ordine)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           etichetta = EXCLUDED.etichetta, tipo = EXCLUDED.tipo,
           opzioni = EXCLUDED.opzioni, obbligatorio = EXCLUDED.obbligatorio,
           ordine = EXCLUDED.ordine`,
        [
          c.id,
          id,
          c.etichetta,
          c.tipo,
          c.opzioni.length > 0 ? c.opzioni.join("\n") : null,
          c.obbligatorio,
          i,
        ]
      );
    }
    await client.query("COMMIT");
    return id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteSondaggio(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM sondaggi WHERE id = $1", [id]);
}

// ===================== SONDAGGI COMPILAZIONI / RISPOSTE / ALLEGATI ======
// Stessa forma di creaCompilazione/getCompilazioniPerUffici/getStatisticheModulo
// sotto: unica differenza, nessun filtro per ufficio (canManageSondaggi è un
// flag unico, non un permesso per-ufficio). Riusa RispostaInput/ModuloRisposta/
// ModuloAllegato/StatisticaCampo/StatisticaOpzione: stessa identica forma.

// Tipi di campo per cui le statistiche aggregano per opzione (conteggio/
// percentuale) invece di elencare le risposte individuali. Condivisa da
// getStatisticheSondaggio qui sotto e getStatisticheModulo più avanti nel file.
const TIPI_CON_OPZIONI_STAT: TipoCampoModulo[] = ["select", "radio", "checkbox"];

// Transazione unica, stesso principio di creaCompilazione: compilazione + tutte
// le risposte (+ eventuali allegati) insieme, senza stati intermedi incompleti.
export async function creaCompilazioneSondaggio(
  sondaggioId: string,
  risposte: RispostaInput[]
): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const compilazioneId = crypto.randomUUID();
    await client.query(
      `INSERT INTO sondaggi_compilazioni (id, sondaggio_id) VALUES ($1,$2)`,
      [compilazioneId, sondaggioId]
    );
    for (let i = 0; i < risposte.length; i++) {
      const r = risposte[i];
      const rispostaId = crypto.randomUUID();
      await client.query(
        `INSERT INTO sondaggi_risposte (id, compilazione_id, campo_id, etichetta, tipo, valore, ordine)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rispostaId, compilazioneId, r.campoId, r.etichetta, r.tipo, r.valore, i]
      );
      if (r.file) {
        await client.query(
          `INSERT INTO sondaggi_compilazioni_allegati (id, compilazione_id, risposta_id, file_name, file_name_originale, mime)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            crypto.randomUUID(),
            compilazioneId,
            rispostaId,
            r.file.storedName,
            r.file.originalName,
            r.file.mime,
          ]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

interface CompilazioneSondaggioRow {
  id: string;
  sondaggio_id: string;
  sondaggio_titolo: string;
  nome_compilatore: string | null;
  email_compilatore: string | null;
  letta: boolean;
  creato_il: string;
}

const COMPILAZIONE_SONDAGGIO_COLS = `
  c.id, c.sondaggio_id, s.titolo AS sondaggio_titolo,
  c.nome_compilatore, c.email_compilatore, c.letta,
  to_char(c.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il
`;

async function getRisposteEAllegatiSondaggio(
  compilazioneIds: string[]
): Promise<Map<string, ModuloRisposta[]>> {
  const map = new Map<string, ModuloRisposta[]>();
  if (compilazioneIds.length === 0) return map;
  const { rows } = await pool.query<RispostaRow>(
    `SELECT id, compilazione_id, campo_id, etichetta, tipo, valore
     FROM sondaggi_risposte WHERE compilazione_id = ANY($1)
     ORDER BY ordine ASC NULLS LAST, creato_il ASC`,
    [compilazioneIds]
  );
  const rispostaIds = rows.map((r) => r.id);
  const { rows: allegati } =
    rispostaIds.length > 0
      ? await pool.query<AllegatoRispostaRow>(
          `SELECT id, risposta_id, file_name_originale FROM sondaggi_compilazioni_allegati
           WHERE risposta_id = ANY($1)`,
          [rispostaIds]
        )
      : { rows: [] as AllegatoRispostaRow[] };
  const allegatoPerRisposta = new Map(allegati.map((a) => [a.risposta_id, a]));

  for (const r of rows) {
    const a = allegatoPerRisposta.get(r.id);
    const risposta: ModuloRisposta = {
      id: r.id,
      campoId: r.campo_id,
      etichetta: r.etichetta,
      tipo: r.tipo as TipoCampoModulo,
      valore: r.valore,
      allegato: a
        ? {
            id: a.id,
            rispostaId: a.risposta_id,
            url: `/api/sondaggi-compilazione-file/${a.id}`,
            fileNameOriginale: a.file_name_originale,
          }
        : null,
    };
    const list = map.get(r.compilazione_id) ?? [];
    list.push(risposta);
    map.set(r.compilazione_id, list);
  }
  return map;
}

function toCompilazioneSondaggio(
  r: CompilazioneSondaggioRow,
  risposte: ModuloRisposta[]
): SondaggioCompilazione {
  return {
    id: r.id,
    sondaggioId: r.sondaggio_id,
    sondaggioTitolo: r.sondaggio_titolo,
    nomeCompilatore: r.nome_compilatore,
    emailCompilatore: r.email_compilatore,
    letta: r.letta,
    creatoIl: r.creato_il,
    risposte,
  };
}

// sondaggioId facoltativo: filtra a un solo sondaggio (tab nell'elenco), altrimenti tutte.
export async function getCompilazioniSondaggi(
  sondaggioId?: string
): Promise<SondaggioCompilazione[]> {
  await ensureSchema();
  const { rows } = sondaggioId
    ? await pool.query<CompilazioneSondaggioRow>(
        `SELECT ${COMPILAZIONE_SONDAGGIO_COLS} FROM sondaggi_compilazioni c
         JOIN sondaggi s ON s.id = c.sondaggio_id
         WHERE c.sondaggio_id = $1
         ORDER BY c.creato_il DESC`,
        [sondaggioId]
      )
    : await pool.query<CompilazioneSondaggioRow>(
        `SELECT ${COMPILAZIONE_SONDAGGIO_COLS} FROM sondaggi_compilazioni c
         JOIN sondaggi s ON s.id = c.sondaggio_id
         ORDER BY c.creato_il DESC`
      );
  const risposte = await getRisposteEAllegatiSondaggio(rows.map((r) => r.id));
  return rows.map((r) => toCompilazioneSondaggio(r, risposte.get(r.id) ?? []));
}

export async function getCompilazioneSondaggio(id: string): Promise<SondaggioCompilazione | null> {
  await ensureSchema();
  const { rows } = await pool.query<CompilazioneSondaggioRow>(
    `SELECT ${COMPILAZIONE_SONDAGGIO_COLS} FROM sondaggi_compilazioni c
     JOIN sondaggi s ON s.id = c.sondaggio_id
     WHERE c.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const risposte = await getRisposteEAllegatiSondaggio([id]);
  return toCompilazioneSondaggio(rows[0], risposte.get(id) ?? []);
}

export async function markCompilazioneSondaggioLetta(id: string, letta: boolean): Promise<void> {
  await ensureSchema();
  await pool.query("UPDATE sondaggi_compilazioni SET letta = $2 WHERE id = $1", [id, letta]);
}

export async function deleteCompilazioneSondaggio(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string }>(
    "SELECT file_name FROM sondaggi_compilazioni_allegati WHERE compilazione_id = $1",
    [id]
  );
  await pool.query("DELETE FROM sondaggi_compilazioni WHERE id = $1", [id]);
  return rows.map((r) => r.file_name);
}

export async function countCompilazioniSondaggiNonLette(): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM sondaggi_compilazioni WHERE letta = false"
  );
  return rows[0].n;
}

export async function getCompilazioneSondaggioAllegatoFile(
  id: string
): Promise<{ fileName: string; mime: string; fileNameOriginale: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<{
    file_name: string;
    mime: string;
    file_name_originale: string;
  }>(
    `SELECT file_name, mime, file_name_originale FROM sondaggi_compilazioni_allegati WHERE id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return { fileName: r.file_name, mime: r.mime, fileNameOriginale: r.file_name_originale };
}

// Riepilogo aggregato delle risposte di un sondaggio, stesso principio di
// getStatisticheModulo sopra (un blocco per domanda, conteggio per opzione o
// elenco risposte individuali), senza filtro per ufficio.
export async function getStatisticheSondaggio(
  sondaggioId: string
): Promise<StatisticheSondaggio | null> {
  const sondaggio = await getSondaggio(sondaggioId);
  if (!sondaggio) return null;

  const compilazioni = await getCompilazioniSondaggi(sondaggioId);

  const blocchi = new Map<string, StatisticaCampo>();
  const ordineOpzioni = new Map<string, string[]>();
  for (const c of sondaggio.campi) {
    if (c.tipo === "testo_statico") continue;
    const conOpzioni = TIPI_CON_OPZIONI_STAT.includes(c.tipo);
    const opzioniOrdine = c.tipo === "checkbox" ? ["Sì", "No"] : c.opzioni;
    if (conOpzioni) ordineOpzioni.set(c.id, opzioniOrdine);
    blocchi.set(c.id, {
      campoId: c.id,
      etichetta: c.etichetta,
      tipo: c.tipo,
      risposteTotali: 0,
      opzioni: conOpzioni ? [] : null,
      valori: conOpzioni ? null : [],
    });
  }

  const conteggiPerBlocco = new Map<string, Map<string, number>>();

  for (const comp of compilazioni) {
    for (const r of comp.risposte) {
      if (!r.valore && !r.allegato) continue;
      const chiave = r.campoId && blocchi.has(r.campoId) ? r.campoId : `orfano:${r.tipo}:${r.etichetta}`;
      let blocco = blocchi.get(chiave);
      if (!blocco) {
        const conOpzioni = TIPI_CON_OPZIONI_STAT.includes(r.tipo);
        blocco = {
          campoId: null,
          etichetta: r.etichetta,
          tipo: r.tipo,
          risposteTotali: 0,
          opzioni: conOpzioni ? [] : null,
          valori: conOpzioni ? null : [],
        };
        blocchi.set(chiave, blocco);
      }
      blocco.risposteTotali++;
      if (blocco.opzioni) {
        const conteggi = conteggiPerBlocco.get(chiave) ?? new Map<string, number>();
        conteggi.set(r.valore, (conteggi.get(r.valore) ?? 0) + 1);
        conteggiPerBlocco.set(chiave, conteggi);
      } else {
        blocco.valori!.push(r.allegato ? r.allegato.fileNameOriginale : r.valore);
      }
    }
  }

  for (const [chiave, blocco] of blocchi) {
    if (!blocco.opzioni) continue;
    const conteggi = conteggiPerBlocco.get(chiave) ?? new Map<string, number>();
    const totale = blocco.risposteTotali || 1;
    const daConteggi = new Map(conteggi);
    const opzioni: StatisticaOpzione[] = [];
    for (const valore of ordineOpzioni.get(chiave) ?? []) {
      const conteggio = daConteggi.get(valore) ?? 0;
      daConteggi.delete(valore);
      opzioni.push({ valore, conteggio, percentuale: Math.round((conteggio / totale) * 100) });
    }
    for (const [valore, conteggio] of daConteggi) {
      opzioni.push({ valore, conteggio, percentuale: Math.round((conteggio / totale) * 100) });
    }
    blocco.opzioni = opzioni;
  }

  return {
    sondaggioId: sondaggio.id,
    sondaggioTitolo: sondaggio.titolo,
    totaleCompilazioni: compilazioni.length,
    campi: Array.from(blocchi.values()),
  };
}

// ===================== MODULI COMPILAZIONI / RISPOSTE / ALLEGATI ========
export interface RispostaInput {
  campoId: string;
  etichetta: string;
  tipo: TipoCampoModulo;
  valore: string;
  file?: { storedName: string; originalName: string; mime: string };
}

// Transazione unica: la compilazione e tutte le sue risposte (+ eventuali
// allegati) vengono create insieme, senza stati intermedi incompleti.
// nome_compilatore/email_compilatore restano in tabella per le compilazioni
// storiche (da quando erano campi fissi del form), ma non si scrivono più:
// se un ufficio vuole raccogliere un nome, lo aggiunge come domanda normale.
export async function creaCompilazione(
  moduloId: string,
  risposte: RispostaInput[]
): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const compilazioneId = crypto.randomUUID();
    await client.query(
      `INSERT INTO moduli_compilazioni (id, modulo_id) VALUES ($1,$2)`,
      [compilazioneId, moduloId]
    );
    for (let i = 0; i < risposte.length; i++) {
      const r = risposte[i];
      const rispostaId = crypto.randomUUID();
      await client.query(
        `INSERT INTO moduli_risposte (id, compilazione_id, campo_id, etichetta, tipo, valore, ordine)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rispostaId, compilazioneId, r.campoId, r.etichetta, r.tipo, r.valore, i]
      );
      if (r.file) {
        await client.query(
          `INSERT INTO moduli_compilazioni_allegati (id, compilazione_id, risposta_id, file_name, file_name_originale, mime)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            crypto.randomUUID(),
            compilazioneId,
            rispostaId,
            r.file.storedName,
            r.file.originalName,
            r.file.mime,
          ]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

interface CompilazioneRow {
  id: string;
  modulo_id: string;
  modulo_titolo: string;
  ufficio_id: string;
  ufficio_nome: string;
  nome_compilatore: string | null;
  email_compilatore: string | null;
  letta: boolean;
  creato_il: string;
}

interface RispostaRow {
  id: string;
  compilazione_id: string;
  campo_id: string | null;
  etichetta: string;
  tipo: string;
  valore: string;
}

interface AllegatoRispostaRow {
  id: string;
  risposta_id: string;
  file_name_originale: string;
}

const COMPILAZIONE_COLS = `
  c.id, c.modulo_id, m.titolo AS modulo_titolo, m.ufficio_id, u.nome AS ufficio_nome,
  c.nome_compilatore, c.email_compilatore, c.letta,
  to_char(c.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il
`;

async function getRisposteEAllegati(
  compilazioneIds: string[]
): Promise<Map<string, ModuloRisposta[]>> {
  const map = new Map<string, ModuloRisposta[]>();
  if (compilazioneIds.length === 0) return map;
  const { rows } = await pool.query<RispostaRow>(
    `SELECT id, compilazione_id, campo_id, etichetta, tipo, valore
     FROM moduli_risposte WHERE compilazione_id = ANY($1)
     ORDER BY ordine ASC NULLS LAST, creato_il ASC`,
    [compilazioneIds]
  );
  const rispostaIds = rows.map((r) => r.id);
  const { rows: allegati } =
    rispostaIds.length > 0
      ? await pool.query<AllegatoRispostaRow>(
          `SELECT id, risposta_id, file_name_originale FROM moduli_compilazioni_allegati
           WHERE risposta_id = ANY($1)`,
          [rispostaIds]
        )
      : { rows: [] as AllegatoRispostaRow[] };
  const allegatoPerRisposta = new Map(allegati.map((a) => [a.risposta_id, a]));

  for (const r of rows) {
    const a = allegatoPerRisposta.get(r.id);
    const risposta: ModuloRisposta = {
      id: r.id,
      campoId: r.campo_id,
      etichetta: r.etichetta,
      tipo: r.tipo as TipoCampoModulo,
      valore: r.valore,
      allegato: a
        ? {
            id: a.id,
            rispostaId: a.risposta_id,
            url: `/api/moduli-compilazione-file/${a.id}`,
            fileNameOriginale: a.file_name_originale,
          }
        : null,
    };
    const list = map.get(r.compilazione_id) ?? [];
    list.push(risposta);
    map.set(r.compilazione_id, list);
  }
  return map;
}

function toCompilazione(r: CompilazioneRow, risposte: ModuloRisposta[]): ModuloCompilazione {
  return {
    id: r.id,
    moduloId: r.modulo_id,
    moduloTitolo: r.modulo_titolo,
    ufficioId: r.ufficio_id,
    ufficioNome: r.ufficio_nome,
    nomeCompilatore: r.nome_compilatore,
    emailCompilatore: r.email_compilatore,
    letta: r.letta,
    creatoIl: r.creato_il,
    risposte,
  };
}

// ufficioIds: null = amministratore (nessun filtro), [] = editor senza uffici (nessun risultato).
export async function getCompilazioniPerUffici(
  ufficioIds: string[] | null,
  moduloId?: string
): Promise<ModuloCompilazione[]> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (ufficioIds) {
    params.push(ufficioIds);
    conditions.push(`m.ufficio_id = ANY($${params.length})`);
  }
  if (moduloId) {
    params.push(moduloId);
    conditions.push(`c.modulo_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<CompilazioneRow>(
    `SELECT ${COMPILAZIONE_COLS} FROM moduli_compilazioni c
     JOIN moduli m ON m.id = c.modulo_id
     JOIN uffici u ON u.id = m.ufficio_id
     ${where}
     ORDER BY c.creato_il DESC`,
    params
  );
  const risposte = await getRisposteEAllegati(rows.map((r) => r.id));
  return rows.map((r) => toCompilazione(r, risposte.get(r.id) ?? []));
}

// Riepilogo aggregato delle risposte di un modulo, stile "Riepilogo" di
// Google Moduli: un blocco per domanda, con conteggio per opzione (select/
// radio/checkbox) o elenco delle risposte individuali (gli altri tipi).
// ufficioIds: null = amministratore (nessun filtro). Ritorna null se il
// modulo non esiste o l'ufficio non è tra quelli consentiti.
export async function getStatisticheModulo(
  moduloId: string,
  ufficioIds: string[] | null
): Promise<StatisticheModulo | null> {
  const modulo = await getModulo(moduloId);
  if (!modulo) return null;
  if (ufficioIds && !ufficioIds.includes(modulo.ufficioId)) return null;

  const compilazioni = await getCompilazioniPerUffici(ufficioIds, moduloId);

  // Un blocco per ogni campo attualmente configurato, nell'ordine
  // dell'editor. Le risposte di campi ormai eliminati (campoId non più tra
  // quelli del modulo) finiscono in blocchi extra in coda, raggruppati per
  // etichetta+tipo storici — nessun dato scompare silenziosamente.
  const blocchi = new Map<string, StatisticaCampo>();
  const ordineOpzioni = new Map<string, string[]>();
  for (const c of modulo.campi) {
    if (c.tipo === "testo_statico") continue;
    const conOpzioni = TIPI_CON_OPZIONI_STAT.includes(c.tipo);
    const opzioniOrdine = c.tipo === "checkbox" ? ["Sì", "No"] : c.opzioni;
    if (conOpzioni) ordineOpzioni.set(c.id, opzioniOrdine);
    blocchi.set(c.id, {
      campoId: c.id,
      etichetta: c.etichetta,
      tipo: c.tipo,
      risposteTotali: 0,
      opzioni: conOpzioni ? [] : null,
      valori: conOpzioni ? null : [],
    });
  }

  const conteggiPerBlocco = new Map<string, Map<string, number>>();

  for (const comp of compilazioni) {
    for (const r of comp.risposte) {
      if (!r.valore && !r.allegato) continue; // risposta lasciata vuota, non conta
      const chiave = r.campoId && blocchi.has(r.campoId) ? r.campoId : `orfano:${r.tipo}:${r.etichetta}`;
      let blocco = blocchi.get(chiave);
      if (!blocco) {
        const conOpzioni = TIPI_CON_OPZIONI_STAT.includes(r.tipo);
        blocco = {
          campoId: null,
          etichetta: r.etichetta,
          tipo: r.tipo,
          risposteTotali: 0,
          opzioni: conOpzioni ? [] : null,
          valori: conOpzioni ? null : [],
        };
        blocchi.set(chiave, blocco);
      }
      blocco.risposteTotali++;
      if (blocco.opzioni) {
        const conteggi = conteggiPerBlocco.get(chiave) ?? new Map<string, number>();
        conteggi.set(r.valore, (conteggi.get(r.valore) ?? 0) + 1);
        conteggiPerBlocco.set(chiave, conteggi);
      } else {
        blocco.valori!.push(r.allegato ? r.allegato.fileNameOriginale : r.valore);
      }
    }
  }

  for (const [chiave, blocco] of blocchi) {
    if (!blocco.opzioni) continue;
    const conteggi = conteggiPerBlocco.get(chiave) ?? new Map<string, number>();
    const totale = blocco.risposteTotali || 1;
    const daConteggi = new Map(conteggi);
    const opzioni: StatisticaOpzione[] = [];
    // Prima le opzioni configurate, nell'ordine dell'editor (anche a 0 voti).
    for (const valore of ordineOpzioni.get(chiave) ?? []) {
      const conteggio = daConteggi.get(valore) ?? 0;
      daConteggi.delete(valore);
      opzioni.push({ valore, conteggio, percentuale: Math.round((conteggio / totale) * 100) });
    }
    // Poi eventuali valori non più tra le opzioni configurate (rimosse/rinominate).
    for (const [valore, conteggio] of daConteggi) {
      opzioni.push({ valore, conteggio, percentuale: Math.round((conteggio / totale) * 100) });
    }
    blocco.opzioni = opzioni;
  }

  return {
    moduloId: modulo.id,
    moduloTitolo: modulo.titolo,
    ufficioNome: modulo.ufficioNome,
    totaleCompilazioni: compilazioni.length,
    campi: Array.from(blocchi.values()),
  };
}

export async function getCompilazione(id: string): Promise<ModuloCompilazione | null> {
  await ensureSchema();
  const { rows } = await pool.query<CompilazioneRow>(
    `SELECT ${COMPILAZIONE_COLS} FROM moduli_compilazioni c
     JOIN moduli m ON m.id = c.modulo_id
     JOIN uffici u ON u.id = m.ufficio_id
     WHERE c.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const risposte = await getRisposteEAllegati([id]);
  return toCompilazione(rows[0], risposte.get(id) ?? []);
}

export async function markCompilazioneLetta(id: string, letta: boolean): Promise<void> {
  await ensureSchema();
  await pool.query("UPDATE moduli_compilazioni SET letta = $2 WHERE id = $1", [id, letta]);
}

export async function deleteCompilazione(id: string): Promise<string[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ file_name: string }>(
    "SELECT file_name FROM moduli_compilazioni_allegati WHERE compilazione_id = $1",
    [id]
  );
  await pool.query("DELETE FROM moduli_compilazioni WHERE id = $1", [id]);
  return rows.map((r) => r.file_name);
}

// ufficioIds: null = amministratore (nessun filtro).
export async function countCompilazioniNonLette(ufficioIds: string[] | null): Promise<number> {
  await ensureSchema();
  const { rows } = ufficioIds
    ? await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM moduli_compilazioni c
         JOIN moduli m ON m.id = c.modulo_id
         WHERE c.letta = false AND m.ufficio_id = ANY($1)`,
        [ufficioIds]
      )
    : await pool.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM moduli_compilazioni WHERE letta = false"
      );
  return rows[0].n;
}

export async function getCompilazioneAllegatoFile(
  id: string
): Promise<{ fileName: string; mime: string; fileNameOriginale: string; ufficioId: string } | null> {
  await ensureSchema();
  const { rows } = await pool.query<{
    file_name: string;
    mime: string;
    file_name_originale: string;
    ufficio_id: string;
  }>(
    `SELECT a.file_name, a.mime, a.file_name_originale, m.ufficio_id
     FROM moduli_compilazioni_allegati a
     JOIN moduli_compilazioni c ON c.id = a.compilazione_id
     JOIN moduli m ON m.id = c.modulo_id
     WHERE a.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    fileName: r.file_name,
    mime: r.mime,
    fileNameOriginale: r.file_name_originale,
    ufficioId: r.ufficio_id,
  };
}

// ===================== PRESENZE / ASSENZE ==============================
// Identità = contatto in rubrica (Contatto.id): nessuna anagrafica separata.

// Giorni di assenza/smartworking (ISO "YYYY-MM-DD" + tipo) di un contatto in un dato mese.
export async function getAssenzeContattoMese(
  contattoId: string,
  anno: number,
  mese: number
): Promise<{ data: string; tipo: StatoPresenza }[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ data: string; tipo: StatoPresenza }>(
    `SELECT to_char(data,'YYYY-MM-DD') AS data, tipo FROM presenze_assenze
     WHERE contatto_id = $1
       AND data >= make_date($2,$3,1) AND data < make_date($2,$3,1) + INTERVAL '1 month'`,
    [contattoId, anno, mese]
  );
  return rows;
}

// Conteggio di assenze/smartworking di un contatto in un anno intero: usato
// dalla statistica "Le mie presenze" sulla pagina personale /admin. Nessuno
// stato registrato = presente, quindi qui si contano solo le eccezioni (non
// esiste un calendario dei giorni lavorativi con cui calcolare una percentuale).
export async function getAssenzeContattoAnno(
  contattoId: string,
  anno: number
): Promise<{ assenze: number; smartworking: number }> {
  await ensureSchema();
  const { rows } = await pool.query<{ tipo: StatoPresenza; n: number }>(
    `SELECT tipo, COUNT(*)::int AS n FROM presenze_assenze
     WHERE contatto_id = $1 AND data >= make_date($2,1,1) AND data < make_date($2 + 1,1,1)
     GROUP BY tipo`,
    [contattoId, anno]
  );
  const perTipo = new Map(rows.map((r) => [r.tipo, r.n]));
  return { assenze: perTipo.get("assente") ?? 0, smartworking: perTipo.get("smartworking") ?? 0 };
}

// Imposta lo stato (assente/smartworking) per quel giorno, o lo rimuove se
// tipo è null (nessuno stato = presente). Restituisce lo stato applicato.
// Sempre origine='manuale': è l'azione di una persona (sé stesso o un
// responsabile), anche quando sovrascrive una riga scritta dalla sync (vedi
// syncPresenzeDaTimbrature sotto, che invece non tocca mai le righe manuali).
export async function impostaPresenza(
  contattoId: string,
  data: string,
  tipo: StatoPresenza | null
): Promise<StatoPresenza | null> {
  await ensureSchema();
  if (tipo === null) {
    await pool.query(
      "DELETE FROM presenze_assenze WHERE contatto_id = $1 AND data = $2",
      [contattoId, data]
    );
    return null;
  }
  await pool.query(
    `INSERT INTO presenze_assenze (id, contatto_id, data, tipo, origine) VALUES ($1,$2,$3,$4,'manuale')
     ON CONFLICT (contatto_id, data) DO UPDATE SET tipo = EXCLUDED.tipo, origine = 'manuale'`,
    [crypto.randomUUID(), contattoId, data, tipo]
  );
  return tipo;
}

// Stato (assente/smartworking) dei contatti in una data: usata dal box "È
// presente?" (il giorno odierno arriva già pronto dal server, senza chiamata di
// rete per ogni ricerca; una data diversa scelta nel filtro viene invece
// richiesta al server).
export async function getStatoPresenzeInData(
  dataIso: string
): Promise<{ id: string; tipo: StatoPresenza }[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ contatto_id: string; tipo: StatoPresenza }>(
    "SELECT contatto_id, tipo FROM presenze_assenze WHERE data = $1",
    [dataIso]
  );
  return rows.map((r) => ({ id: r.contatto_id, tipo: r.tipo }));
}

// Stato (assente/smartworking) dei contatti in un intervallo di date incluso agli
// estremi: usata dal filtro "per periodo" del box "È presente?" per costruire la
// tabella persone × giorni.
export async function getStatoPresenzeInPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<{ id: string; data: string; tipo: StatoPresenza }[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ contatto_id: string; data: string; tipo: StatoPresenza }>(
    `SELECT contatto_id, to_char(data,'YYYY-MM-DD') AS data, tipo FROM presenze_assenze
     WHERE data BETWEEN $1 AND $2`,
    [dataInizio, dataFine]
  );
  return rows.map((r) => ({ id: r.contatto_id, data: r.data, tipo: r.tipo }));
}

export async function countAssenze(): Promise<number> {
  await ensureSchema();
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM presenze_assenze"
  );
  return rows[0].n;
}

export interface AssenteOggi {
  id: string;
  nome: string;
  tipo: StatoPresenza;
}

// Elenco di tutti gli assenti/smartworking di oggi, di qualunque ufficio (usato
// dal widget "Assenti oggi" in home): stesso calcolo della data odierna già
// usato per il risultato "presenza" della ricerca in rubrica, vedi sopra. Niente
// ufficio qui: il widget mostra solo nome e tipologia, l'ufficio è nella pagina
// /presenze per chi vuole il dettaglio.
export async function getAssentiOggi(): Promise<AssenteOggi[]> {
  await ensureSchema();
  const { rows } = await pool.query<{ id: string; nome: string; tipo: StatoPresenza }>(
    `SELECT r.id, r.nome, pa.tipo
     FROM rubrica r
     JOIN presenze_assenze pa ON pa.contatto_id = r.id AND pa.data = $1
     ORDER BY r.nome`,
    [oggiIso()]
  );
  return rows;
}

// ---- Sync da timbrature (Sicraweb) -------------------------------------
// Decisioni utente (2026-09-09, confermate 2026-09-16): conta solo l'entrata
// ("ultimaEntrata" della giornata, verificato che coincide con la prima se il
// check avviene presto — vedi memoria sicraweb); manca → assente. Il manuale
// vince sempre: la sync scrive/cancella solo righe con origine='sync', mai
// origine='manuale'. Esclusi i turnisti della Corpo di Polizia Locale (orari
// non standard, un check mattutino unico li marcherebbe assenti a torto —
// gestione loro non ancora decisa).

// Insieme di parole normalizzate di un nome: minuscolo, senza accenti/
// punteggiatura. Usato per il match invece di un confronto per stringa
// esatta perché rubrica.nome ("Verdi Anna") e i campi separati cognome/nome
// di Sicraweb ("VERDI" / "ANNA MARIA", anagrafica ufficiale con secondo
// nome) non coincidono parola per parola — vedi nota abbinamento sotto.
function paroleNormalizzate(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function chiaveNorm(s: string): string {
  return [...paroleNormalizzate(s)].sort().join(" ");
}

// Vezzeggiativi/diminutivi in rubrica che Sicraweb censisce col nome
// ufficiale esteso — stesso problema già visto nell'import Excel di
// anagrafica_privata (2026-09-09), risolto lì con mapping manuali equivalenti.
// Chiave = nome rubrica normalizzato, valore = parole aggiuntive del nome
// proprio da accettare come match. Aggiungere qui un caso alla volta appena
// scoperto (vedi nonAbbinati nel risultato della sync), non serve altro.
const ALIAS_NOME_PROPRIO: Record<string, string[]> = {
  // es. [chiaveNorm("Bianchi Lella")]: ["gabriella"], // Sicraweb: "BIANCHI GABRIELLA"
};

// Un record Sicraweb abbina una persona del roster se il suo cognome compare
// per intero nel nome rubrica E almeno una parola del nome proprio si
// sovrappone — non l'uguaglianza esatta dell'insieme di parole, che fallisce
// ogni volta che l'anagrafica ufficiale ha un secondo nome che la rubrica non
// riporta (es. "Verdi Anna" in rubrica vs "VERDI"/"ANNA MARIA" da
// Sicraweb: scoperto il 2026-09-16 marcava assenti per errore persone
// presenti). Richiede comunque il cognome intero per non confondere persone
// diverse con lo stesso nome proprio.
function timbratureDellaPersona(
  nomeRubrica: string,
  timbrature: RiepilogoTimbraturaRecord[]
): RiepilogoTimbraturaRecord[] {
  const paroleP = paroleNormalizzate(nomeRubrica);
  for (const w of ALIAS_NOME_PROPRIO[chiaveNorm(nomeRubrica)] ?? []) paroleP.add(w);
  return timbrature.filter((t) => {
    const paroleCognome = paroleNormalizzate(t.cognome);
    const paroleNome = paroleNormalizzate(t.nome);
    const cognomeContenuto = [...paroleCognome].every((w) => paroleP.has(w));
    const nomeSiSovrappone = [...paroleNome].some((w) => paroleP.has(w));
    return paroleCognome.size > 0 && cognomeContenuto && nomeSiSovrappone;
  });
}

interface PersonaRosterSync {
  id: string;
  nome: string;
}

// Chi va controllato dalla sync: dipendenti censiti in anagrafica_privata
// (import 2026-09-09, esclude consiglieri/contatti esterni non veri
// dipendenti) e non assegnati alla Polizia Locale (turni non standard,
// controllata separatamente da syncPresenzePoliziaLocale sotto — un check
// unico al mattino li marcherebbe assenti a torto).
async function getRosterSyncPresenze(): Promise<PersonaRosterSync[]> {
  const { rows } = await pool.query<PersonaRosterSync>(
    `SELECT r.id, r.nome
     FROM rubrica r
     JOIN anagrafica_privata a ON a.contatto_id = r.id
     WHERE NOT EXISTS (
       SELECT 1 FROM rubrica_uffici ru
       JOIN uffici u ON u.id = ru.ufficio_id
       WHERE ru.contatto_id = r.id AND u.nome = 'Corpo di Polizia Locale'
     )`
  );
  return rows;
}

// Speculare alla precedente: solo la Polizia Locale, controllata a orari
// diversi (uno per ogni inizio turno: 7:30/9:00/11:00/13:00, vedi cron) invece
// dei due soli controlli del personale generale.
async function getRosterPoliziaLocaleSync(): Promise<PersonaRosterSync[]> {
  const { rows } = await pool.query<PersonaRosterSync>(
    `SELECT r.id, r.nome
     FROM rubrica r
     JOIN anagrafica_privata a ON a.contatto_id = r.id
     WHERE EXISTS (
       SELECT 1 FROM rubrica_uffici ru
       JOIN uffici u ON u.id = ru.ufficio_id
       WHERE ru.contatto_id = r.id AND u.nome = 'Corpo di Polizia Locale'
     )`
  );
  return rows;
}

export interface RisultatoSyncPresenze {
  data: string;
  roster: number;
  timbratureRicevute: number;
  nonAbbinati: string[];
  marcatiAssente: string[];
  saltatiManuale: string[];
  rimossiSyncPrecedente: string[];
}

// Logica condivisa: interroga Sicraweb, abbina per nome (nessun
// codice_fiscale/matricola in comune tra i due sistemi, vedi memoria
// progetto) e per chi risulta senza timbratura di entrata scrive un'assenza
// con origine='sync' — a meno che esista già una riga manuale per quel
// giorno (manuale vince sempre, riga saltata). Se una persona ha invece
// timbrato ed esisteva una precedente assenza scritta dalla sync, la rimuove
// (un check precedente nella stessa giornata l'aveva marcata assente troppo
// presto — succede spesso qui perché sia il personale generale che la
// Polizia Locale sono controllati più volte al giorno, vedi cron).
async function eseguiSyncPresenze(
  dataIso: string,
  roster: PersonaRosterSync[],
  timbrature: RiepilogoTimbraturaRecord[]
): Promise<RisultatoSyncPresenze> {
  const nonAbbinati: string[] = [];
  const marcatiAssente: string[] = [];
  const saltatiManuale: string[] = [];
  const rimossiSyncPrecedente: string[] = [];

  for (const persona of roster) {
    const trovati = timbratureDellaPersona(persona.nome, timbrature);
    const trovato = trovati.length > 0;
    const haTimbratoEntrata = trovati.some((t) => Boolean(t.ultimaEntrata));

    if (!trovato) nonAbbinati.push(persona.nome);

    if (haTimbratoEntrata) {
      const { rowCount } = await pool.query(
        "DELETE FROM presenze_assenze WHERE contatto_id = $1 AND data = $2 AND origine = 'sync'",
        [persona.id, dataIso]
      );
      if (rowCount) rimossiSyncPrecedente.push(persona.nome);
      continue;
    }

    // Nessuna entrata (o nessuna timbratura affatto): scrive assente, ma solo
    // se non c'è già una riga manuale per quel giorno.
    const { rowCount } = await pool.query(
      `INSERT INTO presenze_assenze (id, contatto_id, data, tipo, origine)
       VALUES ($1,$2,$3,'assente','sync')
       ON CONFLICT (contatto_id, data) DO UPDATE
         SET tipo = 'assente', origine = 'sync'
         WHERE presenze_assenze.origine = 'sync'`,
      [crypto.randomUUID(), persona.id, dataIso]
    );
    if (rowCount) marcatiAssente.push(persona.nome);
    else saltatiManuale.push(persona.nome);
  }

  return {
    data: dataIso,
    roster: roster.length,
    timbratureRicevute: timbrature.length,
    nonAbbinati,
    marcatiAssente,
    saltatiManuale,
    rimossiSyncPrecedente,
  };
}

// Personale generale: due controlli al giorno (9:00/10:00, vedi cron).
export async function syncPresenzeDaTimbrature(dataIso: string): Promise<RisultatoSyncPresenze> {
  await ensureSchema();
  const [roster, timbrature] = await Promise.all([
    getRosterSyncPresenze(),
    getRiepilogoTimbratureGiorno(dataIso),
  ]);
  return eseguiSyncPresenze(dataIso, roster, timbrature);
}

// Polizia Locale: un controllo per ogni inizio turno (7:30/9:00/11:00/13:00,
// vedi cron) invece dei due soli del personale generale — turni non
// standard, un unico check mattutino li marcherebbe assenti a torto.
export async function syncPresenzePoliziaLocale(dataIso: string): Promise<RisultatoSyncPresenze> {
  await ensureSchema();
  const [roster, timbrature] = await Promise.all([
    getRosterPoliziaLocaleSync(),
    getRiepilogoTimbratureGiorno(dataIso),
  ]);
  return eseguiSyncPresenze(dataIso, roster, timbrature);
}

// ===================== PRENOTAZIONE SALE ================================
interface SalaRow {
  id: string;
  nome: string;
  email_notifica: string;
  messaggio_notifica: string;
  bloccata: boolean;
}

function toSala(r: SalaRow): Sala {
  return {
    id: r.id,
    nome: r.nome,
    emailNotifica: r.email_notifica,
    messaggioNotifica: r.messaggio_notifica,
    bloccata: r.bloccata,
  };
}

const SALA_COLS = "id, nome, email_notifica, messaggio_notifica, bloccata";

// Tutte le sale (incluse quelle solo_matrimoni e quelle bloccate), nell'ordine
// configurato (vedi seed in lib/db.ts): usata dal pannello admin per la
// configurazione, che resta accessibile a prescindere da dove/se sono prenotabili.
export async function listSale(): Promise<Sala[]> {
  await ensureSchema();
  const { rows } = await pool.query<SalaRow>(
    `SELECT ${SALA_COLS} FROM sale ORDER BY ordine ASC NULLS LAST, nome ASC`
  );
  return rows.map(toSala);
}

// Sale mostrate nello step "In quale sala vuoi prenotare?" della pagina pubblica
// principale: esclude le sale riservate a sezioni dedicate (solo_matrimoni, vedi
// /prenotazione-sale/matrimoni) e quelle rese non prenotabili dall'admin
// (bloccata, vedi Sala.bloccata in types/index.ts) — restano comunque gestibili
// da listSale() sopra.
export async function listSaleGenerali(): Promise<Sala[]> {
  await ensureSchema();
  const { rows } = await pool.query<SalaRow>(
    `SELECT ${SALA_COLS} FROM sale WHERE solo_matrimoni = false AND bloccata = false
     ORDER BY ordine ASC NULLS LAST, nome ASC`
  );
  return rows.map(toSala);
}

// Le sole due sale prenotabili dalla sezione "Matrimoni": Sala degli Specchi (la
// stessa riga/stesso id della sala della pagina principale — calendario condiviso,
// nessuna duplicazione) e Sala Bernabò (visibile solo qui, solo_matrimoni=true).
// Esclude anche qui le sale bloccate (vedi listSaleGenerali sopra).
export async function listSaleMatrimoni(): Promise<Sala[]> {
  await ensureSchema();
  const { rows } = await pool.query<SalaRow>(
    `SELECT ${SALA_COLS} FROM sale
     WHERE nome IN ('Sala degli Specchi', 'Sala Bernabò') AND bloccata = false
     ORDER BY (nome = 'Sala Bernabò') ASC, nome ASC`
  );
  return rows.map(toSala);
}

export async function getSala(id: string): Promise<Sala | null> {
  await ensureSchema();
  const { rows } = await pool.query<SalaRow>(`SELECT ${SALA_COLS} FROM sale WHERE id = $1`, [id]);
  return rows[0] ? toSala(rows[0]) : null;
}

// Le 4+ sale sono fisse (seed in lib/db.ts), non creabili/eliminabili da admin:
// unico pannello di configurazione per sala, notifica email + interruttore
// "sala non prenotabile" (bloccata, vedi Sala.bloccata in types/index.ts) salvati
// insieme dallo stesso form in /admin/prenotazioni-sale.
export async function updateSalaConfig(
  id: string,
  emailNotifica: string,
  messaggioNotifica: string,
  bloccata: boolean
): Promise<void> {
  await ensureSchema();
  await pool.query(
    "UPDATE sale SET email_notifica = $2, messaggio_notifica = $3, bloccata = $4 WHERE id = $1",
    [id, emailNotifica, messaggioNotifica, bloccata]
  );
}

interface PrenotazioneSalaRow {
  id: string;
  sala_id: string;
  sala_nome: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  contatto_id: string | null;
  richiedente: string;
  richiedente_email: string;
  note: string;
  assistenza_tecnica: boolean;
  assistenza_tecnica_dettaglio: string;
  assistenza_informatica: boolean;
  assistenza_informatica_dettaglio: string;
  creato_il: string;
}

function toPrenotazioneSala(r: PrenotazioneSalaRow): PrenotazioneSala {
  return {
    id: r.id,
    salaId: r.sala_id,
    salaNome: r.sala_nome,
    data: r.data,
    oraInizio: r.ora_inizio,
    oraFine: r.ora_fine,
    contattoId: r.contatto_id,
    richiedente: r.richiedente,
    richiedenteEmail: r.richiedente_email,
    note: r.note,
    assistenzaTecnica: r.assistenza_tecnica,
    assistenzaTecnicaDettaglio: r.assistenza_tecnica_dettaglio,
    assistenzaInformatica: r.assistenza_informatica,
    assistenzaInformaticaDettaglio: r.assistenza_informatica_dettaglio,
    creatoIl: r.creato_il,
  };
}

// to_char(...) su data/ora/creato_il: stesso trattamento delle altre tabelle sopra
// (evita che il driver pg converta DATE/TIMESTAMPTZ in oggetti Date con fusi
// orari inattesi — vedi comunicazioni/segnalazioni). data/ora_inizio/ora_fine sono
// DATE/TIME puri, senza fuso: nessuna conversione Europe/Rome necessaria per questi,
// solo creato_il (TIMESTAMPTZ) va poi mostrato con timeZone: "Europe/Rome" in UI.
const PRENOTAZIONE_SALA_COLS = `
  p.id, p.sala_id, s.nome AS sala_nome,
  to_char(p.data,'YYYY-MM-DD') AS data,
  to_char(p.ora_inizio,'HH24:MI') AS ora_inizio,
  to_char(p.ora_fine,'HH24:MI') AS ora_fine,
  p.contatto_id, p.richiedente, p.richiedente_email, p.note,
  p.assistenza_tecnica, p.assistenza_tecnica_dettaglio,
  p.assistenza_informatica, p.assistenza_informatica_dettaglio,
  to_char(p.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il
`;

// Tutte le prenotazioni (pannello admin), in ordine cronologico.
export async function listPrenotazioniSala(): Promise<PrenotazioneSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     ORDER BY p.data ASC, p.ora_inizio ASC`
  );
  return rows.map(toPrenotazioneSala);
}

// Prenotazioni di una sala in un intervallo di date: usata dal calendario
// settimanale nello step "Quando?" (bollini rossi sulle ore occupate di tutti
// i 7 giorni della settimana visualizzata, non solo del giorno selezionato).
export async function getPrenotazioniSalaInPeriodo(
  salaId: string,
  dataInizio: string,
  dataFine: string
): Promise<PrenotazioneSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     WHERE p.sala_id = $1 AND p.data BETWEEN $2 AND $3
     ORDER BY p.data ASC, p.ora_inizio ASC`,
    [salaId, dataInizio, dataFine]
  );
  return rows.map(toPrenotazioneSala);
}

// Prenotazioni future (data odierna inclusa), più vicine per prime: usata per
// l'elenco mostrato in fondo alla pagina pubblica di prenotazione sale.
// `soloSaleNomi`, se indicato, limita l'elenco a quelle sale (usato dalla sezione
// "Matrimoni" per mostrare solo le prenotazioni di Sala degli Specchi/Sala Bernabò).
export async function getPrenotazioniSalaFuture(
  limit = 30,
  soloSaleNomi?: string[]
): Promise<PrenotazioneSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     WHERE p.data >= CURRENT_DATE
       AND ($2::text[] IS NULL OR s.nome = ANY($2))
     ORDER BY p.data ASC, p.ora_inizio ASC
     LIMIT $1`,
    [limit, soloSaleNomi ?? null]
  );
  return rows.map(toPrenotazioneSala);
}

// Prenotazioni future delle sole sale per cui l'email indicata è configurata come
// destinatario di notifica (sale.email_notifica, lista separata da virgole — vedi
// updateSalaNotifica): usata dal widget personalizzato in home, equivalente "in
// app" della notifica email per chi è responsabile di quella sala (es. un ufficio
// manutenzione). unnest+trim+lower gestisce spazi ed eventuali maiuscole diverse
// nella lista salvata dall'admin, senza richiedere che il formato sia perfetto.
export async function getPrenotazioniSalaDaNotificare(
  email: string,
  limit = 5
): Promise<PrenotazioneSala[]> {
  if (!email) return [];
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     WHERE p.data >= CURRENT_DATE
       AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(s.email_notifica, ',')) AS addr
         WHERE lower(trim(addr)) = lower($1)
       )
     ORDER BY p.data ASC, p.ora_inizio ASC
     LIMIT $2`,
    [email, limit]
  );
  return rows.map(toPrenotazioneSala);
}

// Prenotazioni che stanno accadendo in questo preciso istante: usata dal widget
// "Riunioni in corso" in home. "adesso" viene calcolato lato applicazione con fuso
// Europe/Rome esplicito e passato qui come parametro invece di usare CURRENT_TIME
// di Postgres, perché data/ora_inizio/ora_fine sono valori locali italiani puri
// senza fuso (stesso motivo di getPrenotazioniSalaInPeriodo sopra) — CURRENT_TIME
// dipenderebbe dal fuso del server Postgres, non necessariamente Europe/Rome.
export async function getPrenotazioniInCorso(
  dataOggi: string,
  oraAdesso: string
): Promise<PrenotazioneSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     WHERE p.data = $1 AND p.ora_inizio <= $2 AND p.ora_fine > $2
     ORDER BY s.nome ASC`,
    [dataOggi, oraAdesso]
  );
  return rows.map(toPrenotazioneSala);
}

export interface CreaPrenotazioneSalaInput {
  salaId: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  // Null per un nominativo esterno inserito a mano (non in rubrica) — vedi
  // creaPrenotazioni in prenotazione-sale/actions.ts.
  contattoId: string | null;
  richiedente: string;
  richiedenteEmail: string;
  note: string;
  assistenzaTecnica: boolean;
  assistenzaTecnicaDettaglio: string;
  assistenzaInformatica: boolean;
  assistenzaInformaticaDettaglio: string;
}

// Crea una prenotazione bloccando le sovrapposizioni con quelle già presenti per
// la stessa sala/data (ora_inizio < nuova_fine AND ora_fine > nuova_inizio). Il
// controllo e l'inserimento avvengono nella stessa transazione con FOR UPDATE:
// due richieste inviate nello stesso istante altrimenti supererebbero entrambe
// il controllo prima che l'altra abbia scritto la sua riga (race condition con
// due query separate senza lock).
export async function creaPrenotazioneSala(
  input: CreaPrenotazioneSalaInput
): Promise<{ ok: true; id: string } | { ok: false; errore: string }> {
  await ensureSchema();
  const bloccato = await esisteBloccoSlot(input.salaId, input.data, input.oraInizio, input.oraFine);
  if (bloccato) {
    return {
      ok: false,
      errore: "Questo orario non è disponibile per la prenotazione.",
    };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: conflitti } = await client.query(
      `SELECT id FROM sale_prenotazioni
       WHERE sala_id = $1 AND data = $2 AND ora_inizio < $4 AND ora_fine > $3
       FOR UPDATE`,
      [input.salaId, input.data, input.oraInizio, input.oraFine]
    );
    if (conflitti.length > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        errore: "La sala è già prenotata in quella fascia oraria: scegli un altro orario.",
      };
    }
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO sale_prenotazioni
         (id, sala_id, data, ora_inizio, ora_fine, contatto_id, richiedente, richiedente_email, note,
          assistenza_tecnica, assistenza_tecnica_dettaglio,
          assistenza_informatica, assistenza_informatica_dettaglio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        input.salaId,
        input.data,
        input.oraInizio,
        input.oraFine,
        input.contattoId,
        input.richiedente,
        input.richiedenteEmail,
        input.note,
        input.assistenzaTecnica,
        input.assistenzaTecnicaDettaglio,
        input.assistenzaInformatica,
        input.assistenzaInformaticaDettaglio,
      ]
    );
    await client.query("COMMIT");
    return { ok: true, id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Singola prenotazione: usata da eliminaPrenotazione in (site)/prenotazione-sale/
// actions.ts per rileggere i dettagli (sala/data/orario/richiedente) da mettere nel
// log attività prima di cancellare la riga.
export async function getPrenotazioneSala(id: string): Promise<PrenotazioneSala | null> {
  await ensureSchema();
  const { rows } = await pool.query<PrenotazioneSalaRow>(
    `SELECT ${PRENOTAZIONE_SALA_COLS}
     FROM sale_prenotazioni p JOIN sale s ON s.id = p.sala_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] ? toPrenotazioneSala(rows[0]) : null;
}

export async function deletePrenotazioneSala(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM sale_prenotazioni WHERE id = $1", [id]);
}

// ===================== BLOCCHI SALE (slot orari non prenotabili) ========
interface BloccoSalaRow {
  id: string;
  sala_id: string;
  sala_nome: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  creato_il: string;
}

function toBloccoSala(r: BloccoSalaRow): BloccoSala {
  return {
    id: r.id,
    salaId: r.sala_id,
    salaNome: r.sala_nome,
    data: r.data,
    oraInizio: r.ora_inizio,
    oraFine: r.ora_fine,
    creatoIl: r.creato_il,
  };
}

const BLOCCO_SALA_COLS = `
  b.id, b.sala_id, s.nome AS sala_nome,
  to_char(b.data,'YYYY-MM-DD') AS data,
  to_char(b.ora_inizio,'HH24:MI') AS ora_inizio,
  to_char(b.ora_fine,'HH24:MI') AS ora_fine,
  to_char(b.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il
`;
const BLOCCO_SALA_JOIN = "FROM sale_blocchi b JOIN sale s ON s.id = b.sala_id";

// Tutti gli slot bloccati di una sala (pannello admin /admin/prenotazioni-sale/[salaId]),
// in ordine cronologico.
export async function listBlocchiSala(salaId: string): Promise<BloccoSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<BloccoSalaRow>(
    `SELECT ${BLOCCO_SALA_COLS} ${BLOCCO_SALA_JOIN}
     WHERE b.sala_id = $1 ORDER BY b.data ASC, b.ora_inizio ASC`,
    [salaId]
  );
  return rows.map(toBloccoSala);
}

// Slot bloccati di una sala che ricadono nell'intervallo di date indicato: usata sia
// dal calendario settimanale pubblico (celle non cliccabili, vedi caricaBlocchiSettimana
// in (site)/prenotazione-sale/actions.ts) sia da quello admin per la stessa sala
// (vedi BloccaSlotApp.tsx) — nessuna delle due letture richiede permessi admin, i
// blocchi sono già informazione pubblica (celle non prenotabili nel calendario).
export async function getBlocchiInPeriodo(
  salaId: string,
  dataInizio: string,
  dataFine: string
): Promise<BloccoSala[]> {
  await ensureSchema();
  const { rows } = await pool.query<BloccoSalaRow>(
    `SELECT ${BLOCCO_SALA_COLS} ${BLOCCO_SALA_JOIN}
     WHERE b.sala_id = $1 AND b.data BETWEEN $2 AND $3
     ORDER BY b.data ASC, b.ora_inizio ASC`,
    [salaId, dataInizio, dataFine]
  );
  return rows.map(toBloccoSala);
}

// Vero se lo slot [oraInizio, oraFine) di quella sala/data è (anche solo in parte)
// bloccato: controllo autoritativo lato server prima di creare una prenotazione
// (vedi creaPrenotazioneSala sopra) — non ci si fida del solo filtro lato client sul
// calendario, che potrebbe essere aggirato o non ancora aggiornato. Stessa forma
// della query di conflitto con le prenotazioni già esistenti, sulla nuova tabella.
async function esisteBloccoSlot(
  salaId: string,
  data: string,
  oraInizio: string,
  oraFine: string
): Promise<boolean> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT 1 FROM sale_blocchi
     WHERE sala_id = $1 AND data = $2 AND ora_inizio < $4 AND ora_fine > $3
     LIMIT 1`,
    [salaId, data, oraInizio, oraFine]
  );
  return rows.length > 0;
}

export interface CreaBloccoSalaInput {
  salaId: string;
  data: string;
  oraInizio: string;
  oraFine: string;
}

// Nessun controllo di sovrapposizione con blocchi già presenti: a differenza delle
// prenotazioni pubbliche, qui è l'admin stesso a scegliere gli slot dal calendario
// (che già mostra come "bloccata" una cella già bloccata, quindi non cliccabile),
// un doppio inserimento accidentale non ha conseguenze pratiche.
export async function creaBloccoSala(input: CreaBloccoSalaInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO sale_blocchi (id, sala_id, data, ora_inizio, ora_fine) VALUES ($1,$2,$3,$4,$5)`,
    [crypto.randomUUID(), input.salaId, input.data, input.oraInizio, input.oraFine]
  );
}

export async function deleteBloccoSala(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM sale_blocchi WHERE id = $1", [id]);
}

// ===================== CALENDARIO EVENTI ================================
interface EventoCalendarioRow {
  id: string;
  titolo: string;
  data: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo: string;
  descrizione: string;
  contatto_id: string | null;
  inserito_da: string;
  sala_id: string | null;
  sala_nome: string | null;
  prenotazione_id: string | null;
  creato_il: string;
}

function toEventoCalendario(r: EventoCalendarioRow): EventoCalendario {
  return {
    id: r.id,
    titolo: r.titolo,
    data: r.data,
    oraInizio: r.ora_inizio,
    oraFine: r.ora_fine,
    luogo: r.luogo,
    descrizione: r.descrizione,
    contattoId: r.contatto_id,
    inseritoDa: r.inserito_da,
    salaId: r.sala_id,
    salaNome: r.sala_nome,
    prenotazioneId: r.prenotazione_id,
    creatoIl: r.creato_il,
  };
}

// to_char su data/orari come per le prenotazioni sale: sono DATE/TIME locali
// italiani, il driver li restituirebbe come Date convertite nel fuso del processo
// (UTC in produzione), sfasando il giorno intorno alla mezzanotte.
const EVENTO_CALENDARIO_COLS = `
  e.id, e.titolo, to_char(e.data,'YYYY-MM-DD') AS data,
  to_char(e.ora_inizio,'HH24:MI') AS ora_inizio,
  to_char(e.ora_fine,'HH24:MI') AS ora_fine,
  e.luogo, e.descrizione, e.contatto_id, e.inserito_da,
  e.sala_id, s.nome AS sala_nome, e.prenotazione_id,
  to_char(e.creato_il,'YYYY-MM-DD"T"HH24:MI') AS creato_il
`;
// LEFT JOIN: la sala è facoltativa, e resta NULL anche se viene eliminata dopo
// (sala_id ON DELETE SET NULL), senza far sparire l'evento dal calendario.
const EVENTO_CALENDARIO_JOIN = "FROM eventi_calendario e LEFT JOIN sale s ON s.id = e.sala_id";

// Eventi del calendario compresi tra due date (estremi inclusi): il mese
// visualizzato nella griglia di /calendario. Gli eventi senza orario (giorno
// intero) vengono prima di quelli con orario nello stesso giorno.
export async function listEventiCalendarioInPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<EventoCalendario[]> {
  await ensureSchema();
  const { rows } = await pool.query<EventoCalendarioRow>(
    `SELECT ${EVENTO_CALENDARIO_COLS} ${EVENTO_CALENDARIO_JOIN}
     WHERE e.data BETWEEN $1 AND $2
     ORDER BY e.data ASC, e.ora_inizio ASC NULLS FIRST, e.titolo ASC`,
    [dataInizio, dataFine]
  );
  return rows.map(toEventoCalendario);
}

// Eventi dal giorno indicato in poi: elenco "Prossimi eventi" sotto il calendario
// e widget "Prossimo evento" in home (che poi li unisce a quelli delle
// comunicazioni, vedi lib/calendario.ts).
export async function listEventiCalendarioDa(
  dataDa: string,
  limit = 20
): Promise<EventoCalendario[]> {
  await ensureSchema();
  const { rows } = await pool.query<EventoCalendarioRow>(
    `SELECT ${EVENTO_CALENDARIO_COLS} ${EVENTO_CALENDARIO_JOIN}
     WHERE e.data >= $1
     ORDER BY e.data ASC, e.ora_inizio ASC NULLS FIRST, e.titolo ASC
     LIMIT $2`,
    [dataDa, limit]
  );
  return rows.map(toEventoCalendario);
}

// Singolo evento: usata da eliminaEvento in (site)/calendario/actions.ts per
// rileggere i dettagli da mettere nel log attività prima di cancellare la riga.
export async function getEventoCalendario(id: string): Promise<EventoCalendario | null> {
  await ensureSchema();
  const { rows } = await pool.query<EventoCalendarioRow>(
    `SELECT ${EVENTO_CALENDARIO_COLS} ${EVENTO_CALENDARIO_JOIN} WHERE e.id = $1`,
    [id]
  );
  return rows[0] ? toEventoCalendario(rows[0]) : null;
}

export interface CreaEventoCalendarioInput {
  titolo: string;
  data: string;
  oraInizio: string | null;
  oraFine: string | null;
  luogo: string;
  descrizione: string;
  contattoId: string;
  inseritoDa: string;
  // Sala comunale e prenotazione generata (vedi EventoCalendario in types):
  // entrambe null se l'evento non occupa una sala.
  salaId: string | null;
  prenotazioneId: string | null;
}

// Inserimento di un evento dal calendario pubblico. Nessun controllo di
// sovrapposizione (a differenza delle sale): più eventi possono benissimo cadere
// nello stesso giorno e nella stessa ora, il calendario è una bacheca condivisa,
// non una risorsa da contendere.
export async function creaEventoCalendario(input: CreaEventoCalendarioInput): Promise<string> {
  await ensureSchema();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO eventi_calendario
       (id, titolo, data, ora_inizio, ora_fine, luogo, descrizione, contatto_id, inserito_da,
        sala_id, prenotazione_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      input.titolo,
      input.data,
      input.oraInizio,
      input.oraFine,
      input.luogo,
      input.descrizione,
      input.contattoId,
      input.inseritoDa,
      input.salaId,
      input.prenotazioneId,
    ]
  );
  return id;
}

export async function deleteEventoCalendario(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM eventi_calendario WHERE id = $1", [id]);
}

// Comunicazioni con un evento fissato (campi evento_*) che cade nel periodo
// indicato: confluiscono nel calendario in sola lettura. Basta la data evento
// compilata: significa "questo fatto ha un giorno", quindi va nel calendario.
export async function getComunicazioniConEventoInPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<Comunicazione[]> {
  await ensureSchema();
  const { rows } = await pool.query<ComunicazioneRow>(
    `SELECT ${COM_COLS} ${COM_JOIN}
     WHERE c.evento_data BETWEEN $1 AND $2
     ORDER BY c.evento_data ASC, c.evento_ora_inizio ASC NULLS FIRST`,
    [dataInizio, dataFine]
  );
  return rows.map((r) => toComunicazione(r));
}

// Come sopra ma dal giorno indicato in poi, per l'elenco dei prossimi eventi e
// il widget in home.
export async function getComunicazioniConEventoDa(
  dataDa: string,
  limit = 20
): Promise<Comunicazione[]> {
  await ensureSchema();
  const { rows } = await pool.query<ComunicazioneRow>(
    `SELECT ${COM_COLS} ${COM_JOIN}
     WHERE c.evento_data >= $1
     ORDER BY c.evento_data ASC, c.evento_ora_inizio ASC NULLS FIRST
     LIMIT $2`,
    [dataDa, limit]
  );
  return rows.map((r) => toComunicazione(r));
}

// ===================== LOG ATTIVITÀ (solo admin) ========================
interface LogAttivitaRow {
  id: string;
  quando: string;
  area: string;
  azione: string;
  descrizione: string;
  ip: string;
}

function toLogAttivita(r: LogAttivitaRow): LogAttivita {
  return {
    id: r.id,
    quando: r.quando,
    area: r.area,
    azione: r.azione,
    descrizione: r.descrizione,
    ip: r.ip,
  };
}

export interface RegistraAttivitaInput {
  area: string;
  azione: string;
  descrizione: string;
  ip?: string;
}

// Registra un'azione pubblica senza login nel log di sistema (visibile solo
// all'admin in /admin/log-attivita): senza autenticazione chiunque può
// creare/eliminare prenotazioni, segnalazioni, commenti, comunicazioni non
// ufficiali, compilazioni moduli/sondaggi e presenze, quindi serve una traccia
// di chi ha fatto cosa quando. Va chiamata tramite lib/log-attivita.ts (aggiunge
// l'IP, che richiede il contesto request non disponibile qui). Nessun cron in
// questo progetto: la retention di 30 giorni è applicata ad ogni scrittura,
// cancellando le righe più vecchie invece di un job schedulato a parte.
export async function registraAttivita(input: RegistraAttivitaInput): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO log_attivita (id, area, azione, descrizione, ip) VALUES ($1,$2,$3,$4,$5)`,
    [crypto.randomUUID(), input.area, input.azione, input.descrizione, input.ip ?? ""]
  );
  await pool.query(`DELETE FROM log_attivita WHERE quando < now() - INTERVAL '30 days'`);
}

// Log più recenti per primi: unica lettura, solo per /admin/log-attivita.
export async function listLogAttivita(limit = 500): Promise<LogAttivita[]> {
  await ensureSchema();
  const { rows } = await pool.query<LogAttivitaRow>(
    `SELECT id, to_char(quando,'YYYY-MM-DD"T"HH24:MI:SS') AS quando, area, azione, descrizione, ip
     FROM log_attivita ORDER BY quando DESC LIMIT $1`,
    [limit]
  );
  return rows.map(toLogAttivita);
}

// ===================== MENU (ordinamento) ==============================
// Ordine salvato per il menu indicato: chiave -> posizione. Le voci prive di riga
// (mai riordinate, o aggiunte al codice dopo un riordino) restano fuori dalla mappa;
// il chiamante applica il fallback "ordine del codice" (vedi ordinaConFallback in
// lib/ordina-menu.ts), non serve un seed.
export async function getOrdineMenu(menu: MenuId): Promise<Map<string, number>> {
  await ensureSchema();
  const { rows } = await pool.query<{ chiave: string; ordine: number }>(
    "SELECT chiave, ordine FROM menu_ordine WHERE menu = $1",
    [menu]
  );
  return new Map(rows.map((r) => [r.chiave, r.ordine]));
}

// Persiste il nuovo ordinamento manuale (drag&drop nell'admin): chiavi già nell'ordine
// desiderato, assegna ordine = posizione nell'array. A differenza di reorderServizi
// (solo UPDATE, righe già esistenti per costruzione) qui serve upsert: le voci di menu
// sono fisse nel codice, non righe create dall'admin, quindi la riga di ordinamento
// potrebbe non esistere ancora.
export async function salvaOrdineMenu(menu: MenuId, chiavi: string[]): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < chiavi.length; i++) {
      await client.query(
        `INSERT INTO menu_ordine (menu, chiave, ordine) VALUES ($1,$2,$3)
         ON CONFLICT (menu, chiave) DO UPDATE SET ordine = EXCLUDED.ordine`,
        [menu, chiavi[i], i]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ===================== IMPOSTAZIONI (chiave/valore) ====================
// Tutte le impostazioni configurabili dall'admin in un'unica mappa chiave->valore
// (titolo/sottotitolo Intranet, etichette personalizzate, SMTP...). Una chiave assente
// nella mappa = il chiamante usa il proprio default (stesso principio di
// ordinaConFallback sopra, ma per il testo invece che per l'ordine).
export async function getImpostazioni(): Promise<Record<string, string>> {
  await ensureSchema();
  const { rows } = await pool.query<{ chiave: string; valore: string }>(
    "SELECT chiave, valore FROM impostazioni"
  );
  return Object.fromEntries(rows.map((r) => [r.chiave, r.valore]));
}

// Upsert di più chiavi in un colpo solo (un form può avere più campi): stessa
// transazione di salvaOrdineMenu sopra, stesso motivo (o tutte o nessuna).
export async function salvaImpostazioni(valori: Record<string, string>): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [chiave, valore] of Object.entries(valori)) {
      await client.query(
        `INSERT INTO impostazioni (chiave, valore) VALUES ($1,$2)
         ON CONFLICT (chiave) DO UPDATE SET valore = EXCLUDED.valore`,
        [chiave, valore]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
