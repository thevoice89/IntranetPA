import { Pool } from "pg";
import crypto from "node:crypto";
import { seedComunicazioni, seedServizi } from "@/lib/mock-data";
import { hashPassword } from "@/lib/password";
import { CATEGORIE_COMUNICAZIONE_DEFAULT, UFFICI_COMUNE_DEFAULT } from "@/types";

// Pool PostgreSQL singleton (riusato tra le richieste / HMR in sviluppo).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

// Crea le tabelle (idempotente) e inserisce i dati seed se vuote.
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    // Se l'inizializzazione fallisce (es. Postgres non ancora pronto dopo un
    // riavvio del server) la promise rifiutata non va tenuta: altrimenti ogni
    // richiesta successiva fallirebbe allo stesso modo fino al riavvio del
    // container. Si riprova alla richiesta dopo; initSchema è idempotente.
    schemaPromise = initSchema().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servizi (
      id          TEXT PRIMARY KEY,
      nome        TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      url         TEXT NOT NULL DEFAULT '',
      icona       TEXT NOT NULL DEFAULT '🔗',
      categoria   TEXT NOT NULL DEFAULT '',
      stato       TEXT NOT NULL DEFAULT 'attivo',
      ordine      INTEGER,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti senza la colonna ordine: la aggiunge e
  // valorizza le righe esistenti in base all'ordine di creazione.
  await pool.query("ALTER TABLE servizi ADD COLUMN IF NOT EXISTS ordine INTEGER");
  await pool.query(`
    UPDATE servizi SET ordine = sub.rn
    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY creato_il ASC) AS rn FROM servizi) sub
    WHERE servizi.id = sub.id AND servizi.ordine IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portali (
      id          TEXT PRIMARY KEY,
      nome        TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      url         TEXT NOT NULL DEFAULT '',
      icona       TEXT NOT NULL DEFAULT '🔗',
      categoria   TEXT NOT NULL DEFAULT '',
      stato       TEXT NOT NULL DEFAULT 'attivo',
      ordine      INTEGER,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carta_intestata (
      id        TEXT PRIMARY KEY,
      titolo    TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime      TEXT NOT NULL DEFAULT 'application/octet-stream',
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comunicazioni (
      id          TEXT PRIMARY KEY,
      tipo        TEXT NOT NULL,
      titolo      TEXT NOT NULL,
      estratto    TEXT NOT NULL DEFAULT '',
      corpo       TEXT NOT NULL DEFAULT '',
      autore      TEXT NOT NULL DEFAULT '',
      data        DATE NOT NULL DEFAULT CURRENT_DATE,
      categoria   TEXT NOT NULL DEFAULT 'Generale',
      in_evidenza BOOLEAN NOT NULL DEFAULT false,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti: commenti disattivati per default sulle
  // comunicazioni già presenti (l'admin li abilita comunicazione per comunicazione).
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS commenti_abilitati BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: promemoria per rimandare l'evidenza in home a una data futura
  // (vedi mostraInEvidenza() in lib/format.ts). NULL = nessun promemoria impostato.
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS promemoria_data DATE"
  );
  // Migrazione: scadenza dell'evidenza (vedi mostraInEvidenza() in lib/format.ts).
  // Chiude il periodo di evidenza aperto da promemoria_data (o dalla spunta "in
  // evidenza"): NULL = nessuna scadenza, come oggi.
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS evidenza_fine DATE"
  );
  // Migrazione: evento collegato alla comunicazione (es. un'assemblea, una
  // scadenza). evento_data è la sola che conta: valorizzata, la comunicazione
  // compare nel Calendario del sito (vedi lib/calendario.ts); orari e luogo
  // restano NULL se non compilati (evento di un giorno intero).
  //
  // Esisteva anche mostra_calendario, interruttore del vecchio link "Aggiungi al
  // mio calendario" (invito .ics), funzionalità poi rimossa: la colonna non viene
  // più né letta né scritta e non viene aggiunta ai DB nuovi. Sui DB esistenti
  // NON la si elimina — è NOT NULL DEFAULT false, quindi le INSERT che la
  // ignorano funzionano lo stesso, e una DROP COLUMN su una tabella viva è
  // irreversibile per un guadagno nullo.
  await pool.query("ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS evento_data DATE");
  await pool.query("ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS evento_ora_inizio TEXT");
  await pool.query("ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS evento_ora_fine TEXT");
  await pool.query("ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS evento_luogo TEXT");
  // Migrazione: contatore di visualizzazioni, incrementato ad ogni apertura
  // della pagina di dettaglio pubblica (vedi incrementaVisualizzazioni in lib/data.ts).
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS visualizzazioni INTEGER NOT NULL DEFAULT 0"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comunicazioni_categorie (
      id        TEXT PRIMARY KEY,
      nome      TEXT UNIQUE NOT NULL,
      ordine    INTEGER,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS allegati (
      id               TEXT PRIMARY KEY,
      comunicazione_id TEXT NOT NULL REFERENCES comunicazioni(id) ON DELETE CASCADE,
      tipo             TEXT NOT NULL,
      etichetta        TEXT NOT NULL DEFAULT '',
      url              TEXT,
      file_name        TEXT,
      mime             TEXT,
      creato_il        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comunicazioni_commenti (
      id               TEXT PRIMARY KEY,
      comunicazione_id TEXT NOT NULL REFERENCES comunicazioni(id) ON DELETE CASCADE,
      autore           TEXT NOT NULL,
      testo            TEXT NOT NULL,
      creato_il        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: tracciamento letto/non letto per il badge "Commenti" (admin +
  // widget home), stesso meccanismo già in uso per moduli_compilazioni/segnalazioni.
  await pool.query(
    "ALTER TABLE comunicazioni_commenti ADD COLUMN IF NOT EXISTS letta BOOLEAN NOT NULL DEFAULT false"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                     TEXT PRIMARY KEY,
      username               TEXT UNIQUE NOT NULL,
      salt                   TEXT NOT NULL,
      hash                   TEXT NOT NULL,
      ruolo                  TEXT NOT NULL DEFAULT 'editor',
      can_edit_ufficiali     BOOLEAN NOT NULL DEFAULT false,
      can_edit_non_ufficiali BOOLEAN NOT NULL DEFAULT false,
      creato_il              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: permesso di gestire Sondaggi, indipendente da uffici/comunicazioni
  // (i Sondaggi non hanno un modello a permessi-per-ufficio come Moduli).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_sondaggi BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permesso di gestire le comunicazioni RSU, terzo tipo indipendente
  // da ufficiali/non ufficiali (stesso modello a flag booleano per editor).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_rsu BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permesso di gestire le comunicazioni di Sicurezza sul lavoro,
  // quarto tipo (stesso modello a flag booleano per editor di ufficiali/rsu).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_sicurezza BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permesso di gestire le comunicazioni Eventi, quinto tipo
  // (stesso modello a flag booleano per editor di ufficiali/rsu/sicurezza).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_eventi BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permesso di gestire le comunicazioni Notizie Formazione, sesto
  // tipo (stesso modello a flag booleano per editor di ufficiali/rsu/sicurezza/eventi).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_formazione BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permessi granulari per Rubrica/Regolamenti/Procedure/Guide/Carta
  // Intestata/Segnalazioni. Prima queste sezioni erano aperte a qualunque editor
  // loggato (solo requireUser(), nessun controllo di permesso): DEFAULT false le
  // chiude per tutti gli editor esistenti finché l'admin non le riassegna da
  // "Utenti", coerente con gli altri permessi a flag sopra.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_rubrica BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_regolamenti BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_procedure BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_guide BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_carta_intestata BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_segnalazioni BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: permesso di gestire "Di chi è?" (pacchi in reception), stesso
  // modello a flag booleano di can_manage_segnalazioni.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_pacchi BOOLEAN NOT NULL DEFAULT false"
  );

  // Immagini inserite dentro il testo dall'editor ricco (corpo comunicazione).
  // Tabella a sé e non riga in `allegati`: non sono allegati da scaricare —
  // vivono nel testo e non devono comparire nell'elenco in fondo alla pagina.
  // Nessun legame con la comunicazione: l'immagine si carica mentre si scrive,
  // quando un id di comunicazione ancora non esiste. Il prezzo è che togliere
  // un'immagine dal testo (o cancellare la comunicazione) lascia il file nello
  // storage: sono pochi KB per volta, meglio di un riferimento rotto.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS immagini_testo (
      id        TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime      TEXT NOT NULL,
      creato_da TEXT REFERENCES users(id) ON DELETE SET NULL,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Elenco canonico uffici. Indipendente dal testo libero già usato in rubrica/procedure:
  // serve per il matching esatto richiesto dai permessi per-ufficio (vedi moduli).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uffici (
      id        TEXT PRIMARY KEY,
      nome      TEXT UNIQUE NOT NULL,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: gerarchia Area -> Settore -> Ufficio. `livello` di default 'ufficio'
  // perché le righe già esistenti (elenco piatto) sono tutte foglie; `parent_id`
  // nullo per le Aree (radice). Validità di livello/parent garantita in
  // upsertUnita() (data.ts), non da un CHECK — stesso stile applicativo di
  // deleteUnita() in data.ts invece di un vincolo DB.
  await pool.query("ALTER TABLE uffici ADD COLUMN IF NOT EXISTS livello TEXT NOT NULL DEFAULT 'ufficio'");
  await pool.query(
    "ALTER TABLE uffici ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES uffici(id) ON DELETE RESTRICT"
  );

  // Nota: gli uffici "operativi" di un editor non sono più un'assegnazione manuale
  // indipendente (la vecchia tabella utenti_uffici) — sono ereditati dal contatto
  // rubrica collegato all'utente (rubrica_uffici sotto), vedi getUfficiPerUtenti in
  // lib/data.ts. Un'eventuale tabella utenti_uffici già creata da un'installazione
  // precedente resta in DB inerte (non più letta né scritta), non viene droppata qui.

  await pool.query(`
    CREATE TABLE IF NOT EXISTS regolamenti (
      id        TEXT PRIMARY KEY,
      titolo    TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Generale',
      file_name TEXT NOT NULL,
      mime      TEXT NOT NULL DEFAULT 'application/pdf',
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti senza la colonna categoria.
  await pool.query(
    "ALTER TABLE regolamenti ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Generale'"
  );
  // Testo estratto dal PDF (per la ricerca nel contenuto) + colonna generata
  // tsvector con indice GIN per full-text search in italiano su titolo+testo.
  await pool.query(
    "ALTER TABLE regolamenti ADD COLUMN IF NOT EXISTS testo TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(`
    ALTER TABLE regolamenti ADD COLUMN IF NOT EXISTS testo_tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('italian', coalesce(titolo, '') || ' ' || coalesce(testo, ''))) STORED
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS regolamenti_testo_tsv_idx ON regolamenti USING GIN (testo_tsv)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guide (
      id          TEXT PRIMARY KEY,
      titolo      TEXT NOT NULL,
      categoria   TEXT NOT NULL DEFAULT 'Generale',
      descrizione TEXT NOT NULL DEFAULT '',
      tipo        TEXT NOT NULL DEFAULT 'documento',
      url         TEXT,
      file_name   TEXT,
      mime        TEXT,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guide_materiali (
      id        TEXT PRIMARY KEY,
      guida_id  TEXT NOT NULL REFERENCES guide(id) ON DELETE CASCADE,
      titolo    TEXT NOT NULL DEFAULT '',
      tipo      TEXT NOT NULL DEFAULT 'documento',
      url       TEXT,
      file_name TEXT,
      mime      TEXT,
      ordine    INTEGER,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Migrazione: sposta i dati delle guide "vecchio stile" (con file o url
  // direttamente nella riga) in guide_materiali. Idempotente.
  await pool.query(`
    INSERT INTO guide_materiali (id, guida_id, titolo, tipo, url, file_name, mime, ordine)
    SELECT gen_random_uuid(), g.id, g.titolo, g.tipo, g.url, g.file_name, g.mime, 1
    FROM guide g
    WHERE (g.file_name IS NOT NULL OR (g.url IS NOT NULL AND g.url != ''))
      AND NOT EXISTS (
        SELECT 1 FROM guide_materiali gm WHERE gm.guida_id = g.id
      )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubrica (
      id        TEXT PRIMARY KEY,
      nome      TEXT NOT NULL,
      ufficio   TEXT NOT NULL DEFAULT '',
      ruolo     TEXT NOT NULL DEFAULT '',
      interno   TEXT NOT NULL DEFAULT '',
      telefono  TEXT NOT NULL DEFAULT '',
      cellulare TEXT NOT NULL DEFAULT '',
      email     TEXT NOT NULL DEFAULT '',
      note      TEXT NOT NULL DEFAULT '',
      fonte     TEXT NOT NULL DEFAULT 'manuale',
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: riferimento strutturato alla gerarchia uffici, accanto al testo
  // libero `ufficio` che resta (inerte, non più scritto dal codice nuovo) come
  // rete di sicurezza per non perdere dati già inseriti. Nullable: un contatto
  // può non avere un ufficio assegnato.
  // A sua volta superata da `rubrica_uffici` sotto (un contatto può appartenere
  // a più uffici): resta anche questa colonna inerte, non più scritta/letta.
  await pool.query(
    "ALTER TABLE rubrica ADD COLUMN IF NOT EXISTS ufficio_id TEXT REFERENCES uffici(id) ON DELETE RESTRICT"
  );

  // Un contatto può appartenere a più uffici (stesso pattern di utenti_uffici sopra).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubrica_uffici (
      contatto_id TEXT NOT NULL REFERENCES rubrica(id) ON DELETE CASCADE,
      ufficio_id  TEXT NOT NULL REFERENCES uffici(id) ON DELETE RESTRICT,
      PRIMARY KEY (contatto_id, ufficio_id)
    );
  `);
  // Migrazione una tantum: porta l'eventuale assegnazione singola già presente
  // in rubrica.ufficio_id dentro la nuova tabella many-to-many. Idempotente
  // (ON CONFLICT) e innocua se ufficio_id è già NULL per tutti.
  await pool.query(`
    INSERT INTO rubrica_uffici (contatto_id, ufficio_id)
    SELECT id, ufficio_id FROM rubrica WHERE ufficio_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);

  // Responsabili di ciascun nodo dell'organigramma (Area/Settore/Ufficio).
  // Stessa forma molti-a-molti di rubrica_uffici sopra, e per gli stessi motivi:
  // più responsabili sullo stesso nodo (continuità quando uno è assente o se ne
  // va) e una persona responsabile di più nodi. L'identità è il contatto rubrica
  // e non l'account, così un responsabile resta censito anche prima di avere un
  // login: l'accesso si risolve poi via users.contatto_id, come per il saluto.
  // Chi sovrintende una persona si ricava risalendo l'albero dai suoi uffici
  // (antenatiDi in lib/uffici-tree.ts): un nodo senza responsabile eredita
  // quello del livello superiore, quindi non serve compilarli tutti.
  // Nessuna storicizzazione: la tabella fotografa il presente; ciò che è già
  // stato deciso va congelato sul singolo record, come le etichette in
  // moduli_risposte.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uffici_responsabili (
      ufficio_id  TEXT NOT NULL REFERENCES uffici(id) ON DELETE CASCADE,
      contatto_id TEXT NOT NULL REFERENCES rubrica(id) ON DELETE CASCADE,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (ufficio_id, contatto_id)
    );
  `);

  // Migrazione: collega opzionalmente l'account di login a un contatto della
  // rubrica, così eredita nome e ufficio per il saluto "Ciao <nome>" senza
  // duplicare l'anagrafica in una tabella separata (username/password restano
  // le uniche credenziali proprie dell'utente). SET NULL: cancellare il
  // contatto in rubrica non deve rompere il login, solo scollegare il nome
  // (torna a mostrare lo username).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contatto_id TEXT REFERENCES rubrica(id) ON DELETE SET NULL"
  );

  // ===================== PRESENZE / ASSENZE ==============================
  // Migrazione una tantum: la prima versione identificava la persona con
  // nome+ufficio testo libero (tabella presenze_persone); ora l'identità è
  // ancorata direttamente alla rubrica. Il drop scatta solo se la vecchia
  // tabella esiste ancora, così non cancella mai i dati del nuovo schema
  // ad ogni riavvio.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presenze_persone') THEN
        DROP TABLE IF EXISTS presenze_assenze;
        DROP TABLE IF EXISTS presenze_persone;
      END IF;
    END $$;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS presenze_assenze (
      id          TEXT PRIMARY KEY,
      contatto_id TEXT NOT NULL REFERENCES rubrica(id) ON DELETE CASCADE,
      data        DATE NOT NULL,
      tipo        TEXT NOT NULL DEFAULT 'assente',
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (contatto_id, data)
    );
  `);
  // Aggiunge la distinzione assente/smartworking alle installazioni esistenti
  // (righe già presenti restano "assente", comportamento invariato).
  await pool.query(`ALTER TABLE presenze_assenze ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'assente'`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'presenze_assenze_tipo_check'
      ) THEN
        ALTER TABLE presenze_assenze ADD CONSTRAINT presenze_assenze_tipo_check CHECK (tipo IN ('assente','smartworking'));
      END IF;
    END $$;
  `);
  // Distingue una riga inserita a mano (dal diretto interessato o da un
  // responsabile) da una scritta dalla sync automatica delle timbrature
  // (vedi lib/sicraweb.ts): il manuale vince sempre, la sync non tocca/
  // cancella mai una riga con origine='manuale'. Stesso pattern di
  // rubrica.fonte sopra. Righe già presenti restano 'manuale' (comportamento
  // storico: erano tutte inserimenti umani).
  await pool.query(`ALTER TABLE presenze_assenze ADD COLUMN IF NOT EXISTS origine TEXT NOT NULL DEFAULT 'manuale'`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'presenze_assenze_origine_check'
      ) THEN
        ALTER TABLE presenze_assenze ADD CONSTRAINT presenze_assenze_origine_check CHECK (origine IN ('manuale','sync'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procedure (
      id                 TEXT PRIMARY KEY,
      titolo             TEXT NOT NULL,
      descrizione        TEXT NOT NULL DEFAULT '',
      servizio           TEXT NOT NULL DEFAULT '',
      ufficio            TEXT NOT NULL DEFAULT '',
      referente          TEXT NOT NULL DEFAULT '',
      referente_contatto TEXT NOT NULL DEFAULT '',
      categoria          TEXT NOT NULL DEFAULT 'Generale',
      url                TEXT NOT NULL DEFAULT '',
      creato_il          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti senza la colonna pubblicato (bozza/pubblicata,
  // stesso pattern di moduli.pubblicato). Default true per non nascondere le
  // procedure già esistenti e già visibili sul sito.
  await pool.query(
    "ALTER TABLE procedure ADD COLUMN IF NOT EXISTS pubblicato BOOLEAN NOT NULL DEFAULT true"
  );
  // Migrazione: riferimento strutturato alla gerarchia uffici, stesso trattamento di rubrica.ufficio_id sopra.
  await pool.query(
    "ALTER TABLE procedure ADD COLUMN IF NOT EXISTS ufficio_id TEXT REFERENCES uffici(id) ON DELETE RESTRICT"
  );

  // FAQ: sezione a sé nell'area Procedure, con link opzionale a una procedura
  // specifica (mostrata anche in fondo a /procedure/[id]). Stesso trattamento
  // pubblicato/categoria di procedure sopra.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faq (
      id          TEXT PRIMARY KEY,
      domanda     TEXT NOT NULL,
      risposta    TEXT NOT NULL DEFAULT '',
      categoria   TEXT NOT NULL DEFAULT 'Generale',
      procedura_id TEXT REFERENCES procedure(id) ON DELETE SET NULL,
      pubblicato  BOOLEAN NOT NULL DEFAULT true,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS segnalazioni (
      id        TEXT PRIMARY KEY,
      testo     TEXT NOT NULL,
      autore    TEXT,
      letta     BOOLEAN NOT NULL DEFAULT false,
      creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: nominativo ora obbligatorio (vincolo solo applicativo, vedi
  // inviaSegnalazione in (site)/suggerimenti/actions.ts) e scelto dalla rubrica invece
  // che testo libero. `autore`/`autore_email` restano uno snapshot preso al momento
  // dell'invio (stesso principio di moduli_risposte.etichetta/tipo sopra): la
  // segnalazione storica resta leggibile anche se il contatto viene poi rinominato o
  // eliminato dalla rubrica. `contatto_id`/`user_id` ON DELETE SET NULL: cancellare un
  // contatto o un utente non deve bloccarsi né portarsi via la segnalazione.
  await pool.query(
    "ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS autore_email TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS contatto_id TEXT REFERENCES rubrica(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL"
  );
  // Risposta scritta dall'admin: risposta_email_inviata_il resta NULL finché un invio
  // non riesce, ed è azzerata a ogni nuovo salvataggio della risposta (vedi
  // rispondiSegnalazione in data.ts) così un vecchio "inviata" non resta veritiero
  // dopo che il testo è cambiato.
  await pool.query("ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS risposta_testo TEXT");
  await pool.query("ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS risposta_data TIMESTAMPTZ");
  await pool.query(
    "ALTER TABLE segnalazioni ADD COLUMN IF NOT EXISTS risposta_email_inviata_il TIMESTAMPTZ"
  );

  // ===================== MODULI ==========================================
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli (
      id          TEXT PRIMARY KEY,
      titolo      TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      ufficio_id  TEXT NOT NULL REFERENCES uffici(id) ON DELETE RESTRICT,
      pubblicato  BOOLEAN NOT NULL DEFAULT true,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti: email a cui notificare l'ufficio quando
  // arriva una nuova compilazione (vedi lib/mail.ts). Vuota = nessuna notifica.
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS email_notifica TEXT NOT NULL DEFAULT ''"
  );
  // Migrazione: distingue un modulo "form" (domande, compilazioni) da un
  // modulo "documento" (solo un file già pronto da scaricare, nessuna
  // domanda/compilazione) da un modulo "pdf" (domande online come "form", ma
  // genera un PDF al volo senza salvare nulla — vedi TipoModulo in
  // types/index.ts). Default 'form' per tutti i moduli già esistenti,
  // comportamento invariato.
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'form'"
  );
  // Migrazione: per un modulo di tipo "pdf" (vedi sopra), il PDF generato non è
  // più un elenco domanda/risposta ma una vera lettera in stile documento
  // originale — questi campi (tutti facoltativi, vuoti per i moduli "form"/
  // "documento") forniscono i pezzi mancanti: a chi è indirizzata (con
  // eventuale "per conoscenza"), il corpo in prosa con placeholder
  // {{Etichetta campo}} sostituiti dai valori compilati, e una nota a piè di
  // pagina (es. l'asterisco "(*) Nota:" tipico di questi moduli).
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS pdf_destinatario TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS pdf_destinatario_pc TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS pdf_corpo TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS pdf_nota TEXT NOT NULL DEFAULT ''"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli_campi (
      id           TEXT PRIMARY KEY,
      modulo_id    TEXT NOT NULL REFERENCES moduli(id) ON DELETE CASCADE,
      etichetta    TEXT NOT NULL DEFAULT '',
      tipo         TEXT NOT NULL DEFAULT 'testo',
      opzioni      TEXT,
      obbligatorio BOOLEAN NOT NULL DEFAULT false,
      ordine       INTEGER,
      creato_il    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione per DB già esistenti senza la colonna ordine (editor domande
  // riordinabili): la aggiunge e valorizza le righe esistenti in base
  // all'ordine di creazione, stesso schema di servizi.ordine sopra.
  await pool.query("ALTER TABLE moduli_campi ADD COLUMN IF NOT EXISTS ordine INTEGER");
  await pool.query(`
    UPDATE moduli_campi SET ordine = sub.rn
    FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY modulo_id ORDER BY creato_il ASC) AS rn FROM moduli_campi) sub
    WHERE moduli_campi.id = sub.id AND moduli_campi.ordine IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli_compilazioni (
      id                TEXT PRIMARY KEY,
      modulo_id         TEXT NOT NULL REFERENCES moduli(id) ON DELETE CASCADE,
      nome_compilatore  TEXT,
      email_compilatore TEXT,
      letta             BOOLEAN NOT NULL DEFAULT false,
      creato_il         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Una riga per campo compilato. etichetta/tipo sono uno snapshot al momento
  // dell'invio: se il campo viene poi rinominato/eliminato, la compilazione
  // storica resta leggibile. `ordine` serve perché tutte le righe di una stessa
  // compilazione condividono lo stesso now() (stessa transazione).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli_risposte (
      id              TEXT PRIMARY KEY,
      compilazione_id TEXT NOT NULL REFERENCES moduli_compilazioni(id) ON DELETE CASCADE,
      campo_id        TEXT REFERENCES moduli_campi(id) ON DELETE SET NULL,
      etichetta       TEXT NOT NULL DEFAULT '',
      tipo            TEXT NOT NULL DEFAULT 'testo',
      valore          TEXT NOT NULL DEFAULT '',
      ordine          INTEGER,
      creato_il       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli_compilazioni_allegati (
      id                  TEXT PRIMARY KEY,
      compilazione_id     TEXT NOT NULL REFERENCES moduli_compilazioni(id) ON DELETE CASCADE,
      risposta_id         TEXT NOT NULL REFERENCES moduli_risposte(id) ON DELETE CASCADE,
      file_name           TEXT NOT NULL,
      file_name_originale TEXT NOT NULL DEFAULT '',
      mime                TEXT NOT NULL DEFAULT 'application/octet-stream',
      creato_il           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Allegati (file o link) a corredo del modulo stesso — non le risposte
  // caricate da chi compila (quelle sono in moduli_compilazioni_allegati),
  // ma documenti di riferimento che l'ufficio allega in fase di composizione
  // (es. istruzioni, modello cartaceo), stessa forma della tabella "allegati"
  // usata per le comunicazioni.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moduli_allegati (
      id         TEXT PRIMARY KEY,
      modulo_id  TEXT NOT NULL REFERENCES moduli(id) ON DELETE CASCADE,
      tipo       TEXT NOT NULL,
      etichetta  TEXT NOT NULL DEFAULT '',
      url        TEXT,
      file_name  TEXT,
      mime       TEXT,
      creato_il  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ===================== SONDAGGI ==========================================
  // Stessa forma di moduli/moduli_campi (editor "una pagina sola" stile Google
  // Moduli, stesso set di tipi/opzioni), ma senza ufficio_id/email_notifica:
  // gestibile da chi ha il permesso canManageSondaggi (vedi lib/auth.ts), non un
  // modello a permessi-per-ufficio. Pubblicato = visibile e compilabile da tutti
  // su /sondaggi (vedi getSondaggiPubblicati in lib/data.ts).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sondaggi (
      id          TEXT PRIMARY KEY,
      titolo      TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      pubblicato  BOOLEAN NOT NULL DEFAULT false,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sondaggi_campi (
      id           TEXT PRIMARY KEY,
      sondaggio_id TEXT NOT NULL REFERENCES sondaggi(id) ON DELETE CASCADE,
      etichetta    TEXT NOT NULL DEFAULT '',
      tipo         TEXT NOT NULL DEFAULT 'testo',
      opzioni      TEXT,
      obbligatorio BOOLEAN NOT NULL DEFAULT false,
      ordine       INTEGER,
      creato_il    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Compilazioni pubbliche di un sondaggio: stessa forma di
  // moduli_compilazioni/moduli_risposte/moduli_compilazioni_allegati.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sondaggi_compilazioni (
      id                TEXT PRIMARY KEY,
      sondaggio_id      TEXT NOT NULL REFERENCES sondaggi(id) ON DELETE CASCADE,
      nome_compilatore  TEXT,
      email_compilatore TEXT,
      letta             BOOLEAN NOT NULL DEFAULT false,
      creato_il         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sondaggi_risposte (
      id              TEXT PRIMARY KEY,
      compilazione_id TEXT NOT NULL REFERENCES sondaggi_compilazioni(id) ON DELETE CASCADE,
      campo_id        TEXT REFERENCES sondaggi_campi(id) ON DELETE SET NULL,
      etichetta       TEXT NOT NULL DEFAULT '',
      tipo            TEXT NOT NULL DEFAULT 'testo',
      valore          TEXT NOT NULL DEFAULT '',
      ordine          INTEGER,
      creato_il       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sondaggi_compilazioni_allegati (
      id                  TEXT PRIMARY KEY,
      compilazione_id     TEXT NOT NULL REFERENCES sondaggi_compilazioni(id) ON DELETE CASCADE,
      risposta_id         TEXT NOT NULL REFERENCES sondaggi_risposte(id) ON DELETE CASCADE,
      file_name           TEXT NOT NULL,
      file_name_originale TEXT NOT NULL DEFAULT '',
      mime                TEXT NOT NULL DEFAULT 'application/octet-stream',
      creato_il           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Collegamento facoltativo di una comunicazione (ufficiale o non ufficiale) a
  // un sondaggio: deve stare dopo la creazione di `sondaggi` sopra. ON DELETE
  // SET NULL: eliminare il sondaggio scollega la comunicazione invece di
  // portarsela via.
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS sondaggio_id TEXT REFERENCES sondaggi(id) ON DELETE SET NULL"
  );

  // Stesso meccanismo di sondaggio_id sopra, ma per procedura/modulo/guida: la
  // comunicazione "che pubblicizza" un contenuto appena creato dai rispettivi
  // form (checkbox "Pubblica anche una comunicazione ufficiale"). ON DELETE SET
  // NULL: eliminare la procedura/modulo/guida scollega la comunicazione invece
  // di portarsela via. Tabelle già create sopra (guide/procedure/moduli).
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS procedura_id TEXT REFERENCES procedure(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS modulo_id TEXT REFERENCES moduli(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS guida_id TEXT REFERENCES guide(id) ON DELETE SET NULL"
  );

  // ===================== PRENOTAZIONE SALE ================================
  // Elenco fisso delle 4 sale comunali (seed sotto): nessuna creazione/eliminazione
  // da pannello, solo configurazione di email_notifica/messaggio_notifica per sala
  // (vedi lib/mail.ts). `ordine` fissa la posizione nello step "In quale sala vuoi
  // prenotare?", stesso trattamento di servizi.ordine sopra.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale (
      id                  TEXT PRIMARY KEY,
      nome                TEXT UNIQUE NOT NULL,
      ordine              INTEGER,
      email_notifica      TEXT NOT NULL DEFAULT '',
      messaggio_notifica  TEXT NOT NULL DEFAULT '',
      creato_il           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Sale riservate alla sezione "Matrimoni" (/prenotazione-sale/matrimoni): escluse
  // dallo step "In quale sala vuoi prenotare?" della pagina principale
  // (vedi listSaleGenerali in lib/data.ts), ma restano gestibili come tutte le
  // altre nel pannello admin (listSale non filtra su questa colonna).
  await pool.query(
    "ALTER TABLE sale ADD COLUMN IF NOT EXISTS solo_matrimoni BOOLEAN NOT NULL DEFAULT false"
  );
  // Interruttore "sala non prenotabile" (vedi Sala.bloccata in types/index.ts):
  // esclude la sala da listSaleGenerali/listSaleMatrimoni e viene ricontrollato
  // lato server prima di creare una prenotazione.
  await pool.query("ALTER TABLE sale ADD COLUMN IF NOT EXISTS bloccata BOOLEAN NOT NULL DEFAULT false");

  // Una riga per prenotazione. contatto_id ON DELETE SET NULL: cancellare un
  // contatto dalla rubrica non deve portarsi via lo storico prenotazioni (stesso
  // principio di segnalazioni.contatto_id sopra); richiedente/richiedente_email
  // restano uno snapshot al momento della prenotazione. data/ora_inizio/ora_fine
  // sono DATE/TIME (non TIMESTAMPTZ): nessuna conversione di fuso orario in gioco,
  // a differenza di creato_il (vedi to_char(...) nelle query di lettura in data.ts).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale_prenotazioni (
      id                 TEXT PRIMARY KEY,
      sala_id            TEXT NOT NULL REFERENCES sale(id) ON DELETE CASCADE,
      data               DATE NOT NULL,
      ora_inizio         TIME NOT NULL,
      ora_fine           TIME NOT NULL,
      contatto_id        TEXT REFERENCES rubrica(id) ON DELETE SET NULL,
      richiedente        TEXT NOT NULL DEFAULT '',
      richiedente_email  TEXT NOT NULL DEFAULT '',
      note               TEXT NOT NULL DEFAULT '',
      creato_il          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS sale_prenotazioni_sala_data_idx ON sale_prenotazioni (sala_id, data)"
  );
  // Flag facoltativi richiesti in fase di prenotazione: se attivi, inviano una
  // notifica separata (vedi inviaNotificaAssistenza in lib/mail.ts) ai destinatari
  // configurati in /admin/prenotazioni-sale (chiavi impostazioni
  // email_assistenza_tecnica/email_assistenza_informatica), indipendenti dalla
  // notifica per sala.
  await pool.query(
    "ALTER TABLE sale_prenotazioni ADD COLUMN IF NOT EXISTS assistenza_tecnica BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE sale_prenotazioni ADD COLUMN IF NOT EXISTS assistenza_informatica BOOLEAN NOT NULL DEFAULT false"
  );
  // Dettaglio libero ("cosa ti serve") mostrato solo se il flag corrispondente è
  // attivo (vedi PrenotazioneSaleApp.tsx): salvato comunque anche se il flag è
  // false il campo arriva vuoto, azzerato lato server in creaPrenotazioni.
  await pool.query(
    "ALTER TABLE sale_prenotazioni ADD COLUMN IF NOT EXISTS assistenza_tecnica_dettaglio TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE sale_prenotazioni ADD COLUMN IF NOT EXISTS assistenza_informatica_dettaglio TEXT NOT NULL DEFAULT ''"
  );

  // Migrazione: sale_blocchi è stata ridisegnata il giorno stesso del primo
  // deploy (da periodo/giorno intero con sala_id opzionale, a slot orari puntuali
  // sempre legati a una sala) dopo il primo tentativo — mai avuta adozione reale
  // (0 righe in produzione), quindi il drop è sicuro. Scatta solo se la vecchia
  // colonna esiste ancora, così non cancella mai dati della nuova forma.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sale_blocchi' AND column_name = 'data_inizio'
      ) THEN
        DROP TABLE sale_blocchi;
      END IF;
    END $$;
  `);
  // Slot orari (stessa granularità di sale_prenotazioni) che l'admin ha reso non
  // prenotabili per una sala specifica, senza dover indicare un motivo: vedi
  // BloccoSala in types/index.ts e /admin/prenotazioni-sale/[salaId]. sala_id
  // sempre valorizzato (a differenza del primo tentativo): l'inibizione
  // dell'intera sala è un concetto distinto, vedi sale.bloccata sopra.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale_blocchi (
      id         TEXT PRIMARY KEY,
      sala_id    TEXT NOT NULL REFERENCES sale(id) ON DELETE CASCADE,
      data       DATE NOT NULL,
      ora_inizio TIME NOT NULL,
      ora_fine   TIME NOT NULL,
      creato_il  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS sale_blocchi_sala_data_idx ON sale_blocchi (sala_id, data)"
  );

  // ===================== CALENDARIO EVENTI ================================
  // Eventi inseriti direttamente dalla sezione pubblica /calendario, cliccando un
  // giorno (senza login, nominativo obbligatorio dalla rubrica: stesso principio di
  // Prenotazione sale e Segnalazioni). Nel calendario a video confluiscono anche gli
  // eventi già fissati nelle comunicazioni (colonne evento_* della tabella
  // comunicazioni, vedi sopra): quelli NON vengono copiati qui, restano nella loro
  // comunicazione e vengono uniti in lettura da lib/calendario.ts — così modificare
  // la comunicazione aggiorna il calendario senza sincronizzazioni da mantenere.
  // data/ora_inizio/ora_fine sono DATE/TIME (non TIMESTAMPTZ): valori locali
  // italiani puri, nessuna conversione di fuso in gioco, come in sale_prenotazioni.
  // Gli orari sono facoltativi: senza ora di inizio l'evento è di un giorno intero.
  // contatto_id ON DELETE SET NULL con `inserito_da` come snapshot del nome:
  // cancellare un contatto dalla rubrica non deve portarsi via gli eventi già
  // inseriti (stesso trattamento di sale_prenotazioni.richiedente).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventi_calendario (
      id          TEXT PRIMARY KEY,
      titolo      TEXT NOT NULL,
      data        DATE NOT NULL,
      ora_inizio  TIME,
      ora_fine    TIME,
      luogo       TEXT NOT NULL DEFAULT '',
      descrizione TEXT NOT NULL DEFAULT '',
      contatto_id TEXT REFERENCES rubrica(id) ON DELETE SET NULL,
      inserito_da TEXT NOT NULL DEFAULT '',
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS eventi_calendario_data_idx ON eventi_calendario (data)"
  );
  // Sala comunale scelta per l'evento e prenotazione generata di conseguenza: se
  // chi crea l'evento indica una sala, la sala risulta occupata in Prenotazione
  // sale per l'orario dell'evento, senza doverla prenotare a parte. Il legame è
  // a senso unico: le prenotazioni fatte dalla sezione sale NON diventano eventi
  // in calendario (sono riunioni interne, non fatti da pubblicizzare).
  // prenotazione_id ON DELETE SET NULL: se la prenotazione viene eliminata dalla
  // sua sezione, l'evento resta in calendario e perde solo il collegamento.
  await pool.query(
    "ALTER TABLE eventi_calendario ADD COLUMN IF NOT EXISTS sala_id TEXT REFERENCES sale(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE eventi_calendario ADD COLUMN IF NOT EXISTS prenotazione_id TEXT REFERENCES sale_prenotazioni(id) ON DELETE SET NULL"
  );
  // Il calendario legge anche le comunicazioni con un evento: senza indice su
  // evento_data ogni mese visualizzato costringerebbe a una scansione completa
  // della tabella comunicazioni. Parziale (solo le righe con evento) perché la
  // grande maggioranza delle comunicazioni non ne ha uno.
  await pool.query(
    "CREATE INDEX IF NOT EXISTS comunicazioni_evento_data_idx ON comunicazioni (evento_data) WHERE evento_data IS NOT NULL"
  );

  // ===================== LOG ATTIVITÀ (solo admin) =======================
  // Traccia le azioni pubbliche senza login (prenotazioni sale, segnalazioni,
  // commenti, comunicazioni non ufficiali, moduli/sondaggi, presenze): senza
  // autenticazione chiunque può creare/eliminare, quindi serve un modo per
  // l'admin di vedere chi ha fatto cosa (vedi lib/log-attivita.ts). Nessun
  // cron in questo progetto: la retention di 30 giorni è applicata a ogni
  // scrittura in data.registraAttivita (DELETE delle righe più vecchie).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_attivita (
      id          TEXT PRIMARY KEY,
      quando      TIMESTAMPTZ NOT NULL DEFAULT now(),
      area        TEXT NOT NULL,
      azione      TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      ip          TEXT NOT NULL DEFAULT ''
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS log_attivita_quando_idx ON log_attivita (quando DESC)"
  );

  // ===================== PACCHI ("Di chi è?") =============================
  // La reception registra un pacco arrivato senza destinatario chiaro; il pacco
  // resta "in attesa" (rivendicato_il NULL) finché qualcuno, dalla pagina pubblica
  // /di-chi-e/[id] raggiunta dal widget in home, dichiara che è suo scegliendo il
  // proprio nominativo dalla rubrica. `rivendicato_nome`/`rivendicato_email` sono
  // uno snapshot (stesso principio di segnalazioni.autore/autore_email): la
  // dichiarazione resta leggibile anche se il contatto viene poi rinominato o
  // eliminato dalla rubrica. `creato_da` ON DELETE SET NULL: cancellare l'utente
  // reception non deve portarsi via lo storico dei pacchi.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pacchi (
      id                TEXT PRIMARY KEY,
      data_arrivo       DATE NOT NULL,
      mittente          TEXT NOT NULL DEFAULT '',
      descrizione       TEXT NOT NULL DEFAULT '',
      foto_file_name    TEXT,
      foto_mime         TEXT,
      creato_da         TEXT REFERENCES users(id) ON DELETE SET NULL,
      rivendicato_da    TEXT REFERENCES rubrica(id) ON DELETE SET NULL,
      rivendicato_nome  TEXT,
      rivendicato_email TEXT,
      rivendicato_il    TIMESTAMPTZ,
      creato_il         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // ===================== MENU (ordinamento) ==============================
  // Riordino manuale delle voci del menu pubblico e del menu admin (entrambi
  // altrimenti nell'ordine fisso definito nel codice). "chiave" = AppRoute.path per
  // il menu pubblico, AdminMenuItem.href per l'admin: riusa un identificatore già
  // univoco invece di introdurne uno nuovo da mantenere allineato a mano. Tabella di
  // lookup puro (niente creato_il), stesso trattamento di utenti_uffici/rubrica_uffici
  // sopra. Una voce senza riga qui (mai riordinata, o aggiunta al codice dopo un
  // riordino) usa il fallback "posizione nel codice" a livello applicativo
  // (vedi ordinaConFallback in lib/ordina-menu.ts), non serve seed.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_ordine (
      menu   TEXT NOT NULL,
      chiave TEXT NOT NULL,
      ordine INTEGER NOT NULL,
      PRIMARY KEY (menu, chiave)
    );
  `);

  // ===================== IMPOSTAZIONI (chiave/valore) ====================
  // Tabella generica per le impostazioni configurabili dall'admin (titolo/sottotitolo
  // dell'Intranet, etichette personalizzate di voci di menu/sezioni home, SMTP): una
  // riga per chiave, assente = usa il default del codice (vedi lib/etichette-menu.ts
  // e lib/mail.ts per i rispettivi fallback), stesso principio di menu_ordine sopra.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS impostazioni (
      chiave TEXT PRIMARY KEY,
      valore TEXT NOT NULL DEFAULT ''
    );
  `);

  // ===================== PROPRIETARIO (comunicazioni/moduli/sondaggi) ====
  // Editor non-admin: possono modificare/eliminare solo ciò che hanno creato
  // loro stessi (l'admin bypassa sempre, vedi canEditComunicazioneItem/
  // canManageModuloItem/canManageSondaggioItem in lib/auth.ts). SET NULL:
  // cancellare l'utente non deve portarsi via il contenuto, solo scollegarlo
  // (torna gestibile solo dall'admin, stesso comportamento di un elemento
  // storico senza proprietario noto).
  await pool.query(
    "ALTER TABLE comunicazioni ADD COLUMN IF NOT EXISTS creato_da TEXT REFERENCES users(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE moduli ADD COLUMN IF NOT EXISTS creato_da TEXT REFERENCES users(id) ON DELETE SET NULL"
  );
  await pool.query(
    "ALTER TABLE sondaggi ADD COLUMN IF NOT EXISTS creato_da TEXT REFERENCES users(id) ON DELETE SET NULL"
  );
  // Migrazione una tantum per le comunicazioni già esistenti: a differenza di
  // moduli/sondaggi, l'autore di una comunicazione è sempre risolto da un
  // contatto reale della rubrica (mai testo libero, vedi saveComunicazione in
  // admin/actions.ts), quindi se quel contatto è a sua volta collegato a un
  // account utente possiamo risalire al proprietario anche per il pregresso.
  // Moduli e sondaggi non hanno un campo equivalente: restano senza
  // proprietario (gestibili solo dall'admin) finché non vengono ri-salvati.
  await pool.query(`
    UPDATE comunicazioni c SET creato_da = u.id
    FROM rubrica r JOIN users u ON u.contatto_id = r.id
    WHERE c.creato_da IS NULL AND r.nome = c.autore
  `);

  // ===================== FORMAZIONE =======================================
  // can_edit_formazione (avvisi/opportunità come sesto tipo di comunicazione)
  // è esistito qui brevemente: la bacheca è stata scorporata dalle Comunicazioni
  // in un'entità propria (formazione_avvisi sotto) aperta a QUALUNQUE utente
  // loggato, senza più un permesso dedicato. Colonna volutamente non droppata
  // sui DB già migrati (mai irreversibile una DROP COLUMN per un guadagno nullo,
  // stesso principio di comunicazioni.mostra_calendario sopra), solo non più
  // letta/scritta da questo codice.
  // Migrazione: permesso piatto (non legato alla gerarchia uffici_responsabili)
  // per chi deve vedere le attività formative di TUTTI i dipendenti (es. Gestione
  // del Personale per la relazione annuale), indipendentemente da chi sovrintende
  // chi — stesso principio di can_manage_segnalazioni/can_manage_pacchi.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_vedere_formazione_tutti BOOLEAN NOT NULL DEFAULT false"
  );
  // Migrazione: attribuzione facoltativa di una Guida (ora "Formazione dei
  // colleghi per i colleghi") al collega che ha condiviso la competenza — non
  // necessariamente chi l'ha materialmente inserita nel pannello (creato_da non
  // basterebbe: chi digita il contenuto può essere un'altra persona). SET NULL:
  // cancellare il contatto non deve rompere la guida, solo scollegare il nome.
  await pool.query(
    "ALTER TABLE guide ADD COLUMN IF NOT EXISTS autore_contatto_id TEXT REFERENCES rubrica(id) ON DELETE SET NULL"
  );
  // Attività formative auto-dichiarate dai dipendenti (corsi seguiti, ore,
  // attestato): contatto_id è sempre il proprio (vedi requireUser()+
  // user.contattoId in (site)/formazione/actions.ts, mai un id postato dal
  // client), non un'assegnazione libera come rubrica_uffici. Un solo file per
  // riga (attestato_*, nullable) invece di una tabella allegati a parte: un
  // corso ha tipicamente un solo attestato, stesso principio "campo diretto
  // sulla riga" di regolamenti prima dell'introduzione di guide_materiali.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS formazione_attivita (
      id                            TEXT PRIMARY KEY,
      contatto_id                   TEXT NOT NULL REFERENCES rubrica(id) ON DELETE CASCADE,
      titolo_corso                  TEXT NOT NULL,
      ente_erogatore                TEXT NOT NULL DEFAULT '',
      data_corso                    DATE NOT NULL DEFAULT CURRENT_DATE,
      ore_previste                  NUMERIC NOT NULL DEFAULT 0,
      ore                           NUMERIC NOT NULL DEFAULT 0,
      certificazione_competenze     BOOLEAN NOT NULL DEFAULT false,
      modalita_fruizione            TEXT NOT NULL DEFAULT '',
      attestato_file_name           TEXT,
      attestato_file_name_originale TEXT,
      attestato_mime                TEXT,
      creato_il                     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Colonne aggiunte dopo la creazione iniziale della tabella (vedi
  // [[project_formazione_fix_welcome_2026-09-09]] in memoria): campi allineati
  // alla scheda di rilevazione formazione fornita dall'utente. "titolo_corso"
  // e "ore" restano i nomi fisici storici della colonna: la query di lettura
  // li rinomina in "descrizione_percorso"/"ore_svolte" (vedi FORMAZIONE_COLS),
  // così non serve una RENAME COLUMN qui.
  await pool.query(
    "ALTER TABLE formazione_attivita ADD COLUMN IF NOT EXISTS ore_previste NUMERIC NOT NULL DEFAULT 0"
  );
  await pool.query(
    "ALTER TABLE formazione_attivita ADD COLUMN IF NOT EXISTS certificazione_competenze BOOLEAN NOT NULL DEFAULT false"
  );
  await pool.query(
    "ALTER TABLE formazione_attivita ADD COLUMN IF NOT EXISTS modalita_fruizione TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE formazione_attivita ADD COLUMN IF NOT EXISTS area_tematica TEXT NOT NULL DEFAULT ''"
  );
  await pool.query("ALTER TABLE formazione_attivita DROP COLUMN IF EXISTS note");

  // Dati privati per persona, mai un'anagrafica pubblica: stesso principio di
  // formazione_attivita sopra, chiave contatto_id in rubrica. Caricati in
  // blocco da un file fornito dall'ufficio del personale, non da un form
  // admin: leggibili solo dal proprio account collegato (user.contattoId,
  // vedi getAnagraficaPrivata) e da procedure lato server come Formazione —
  // mai esposti dalla rubrica pubblica o da un'API pubblica.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anagrafica_privata (
      contatto_id      TEXT PRIMARY KEY REFERENCES rubrica(id) ON DELETE CASCADE,
      categoria_lavoro TEXT NOT NULL DEFAULT '',
      data_nascita     DATE,
      creato_il        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazione: genere (valori "U"/"D", stessa codifica del file fornito
  // dall'ufficio del personale), richiesto per l'esportazione Formazione in
  // formato allineato alla tabella di riepilogo dell'ente — vuoto finché non
  // backfillato dal file sorgente.
  await pool.query(
    "ALTER TABLE anagrafica_privata ADD COLUMN IF NOT EXISTS genere TEXT NOT NULL DEFAULT ''"
  );

  // Migrazione: permesso di esportare la tabella Formazione in un file Excel
  // nello schema del riepilogo ente (vedi /admin/formazione e
  // /api/formazione-esporta) — pensato per un'utenza dedicata all'estrazione
  // dati, non necessariamente un editor. Implica la stessa visibilità totale
  // di can_vedere_formazione_tutti (serve vedere tutti per esportare tutti).
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_esportare_formazione BOOLEAN NOT NULL DEFAULT false"
  );

  // Migrazione: versione di sessione, inclusa nel cookie firmato (vedi
  // makeToken in lib/auth.ts). Un cambio password la incrementa e invalida
  // tutti i cookie emessi prima. Default 0 = stessa versione attribuita ai
  // cookie emessi prima di questa colonna: nessuno viene disconnesso.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sessione_versione INTEGER NOT NULL DEFAULT 0"
  );

  // Bacheca "Avvisi e opportunità formative": aperta a QUALUNQUE utente loggato
  // (non un tipo di comunicazione con permesso dedicato, vedi nota can_edit_formazione
  // sopra). autore è uno snapshot del nome al momento della pubblicazione (stesso
  // principio di segnalazioni.autore), creato_da l'id utente proprietario per i
  // controlli di modifica/eliminazione (vedi canEditFormazioneAvviso in lib/auth.ts).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS formazione_avvisi (
      id          TEXT PRIMARY KEY,
      titolo      TEXT NOT NULL,
      descrizione TEXT NOT NULL DEFAULT '',
      autore      TEXT NOT NULL DEFAULT '',
      creato_da   TEXT REFERENCES users(id) ON DELETE SET NULL,
      creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Allegati (file o link) dell'avviso: stessa identica forma di allegati/moduli_allegati.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS formazione_avvisi_allegati (
      id         TEXT PRIMARY KEY,
      avviso_id  TEXT NOT NULL REFERENCES formazione_avvisi(id) ON DELETE CASCADE,
      tipo       TEXT NOT NULL,
      etichetta  TEXT NOT NULL DEFAULT '',
      url        TEXT,
      file_name  TEXT,
      mime       TEXT,
      creato_il  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await seedIfEmpty();
}

async function seedIfEmpty(): Promise<void> {
  const { rows: s } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM servizi"
  );
  if (s[0].n === 0) {
    for (const x of seedServizi) {
      await pool.query(
        `INSERT INTO servizi (id, nome, descrizione, url, icona, categoria, stato)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [x.id, x.nome, x.descrizione, x.url, x.icona, x.categoria, x.stato]
      );
    }
  }

  const { rows: c } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM comunicazioni"
  );
  if (c[0].n === 0) {
    for (const x of seedComunicazioni) {
      await pool.query(
        `INSERT INTO comunicazioni (id, tipo, titolo, estratto, corpo, autore, data, categoria, in_evidenza)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [x.id, x.tipo, x.titolo, x.estratto, x.corpo, x.autore, x.data, x.categoria, x.inEvidenza]
      );
    }
  }

  const { rows: cc } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM comunicazioni_categorie"
  );
  if (cc[0].n === 0) {
    for (let i = 0; i < CATEGORIE_COMUNICAZIONE_DEFAULT.length; i++) {
      await pool.query(
        `INSERT INTO comunicazioni_categorie (id, nome, ordine) VALUES ($1,$2,$3) ON CONFLICT (nome) DO NOTHING`,
        [crypto.randomUUID(), CATEGORIE_COMUNICAZIONE_DEFAULT[i], i]
      );
    }
  }

  // Seed uffici: pre-popola con la gerarchia ufficiale del Comune (Area -> Settore
  // -> Ufficio, fonte: organigramma comunale), solo se la tabella è vuota
  // (altrimenti un nodo cancellato dall'admin ricomparirebbe ad ogni riavvio).
  // Su produzione (già popolata prima che esistesse la gerarchia) questo blocco
  // non scatta più: la migrazione a 3 livelli lì è uno script a parte.
  const { rows: uf } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM uffici"
  );
  if (uf[0].n === 0) {
    for (const areaNode of UFFICI_COMUNE_DEFAULT) {
      const areaId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO uffici (id, nome, livello, parent_id) VALUES ($1,$2,'area',NULL) ON CONFLICT (nome) DO NOTHING",
        [areaId, areaNode.area]
      );
      for (const settoreNode of areaNode.settori) {
        const settoreId = crypto.randomUUID();
        await pool.query(
          "INSERT INTO uffici (id, nome, livello, parent_id) VALUES ($1,$2,'settore',$3) ON CONFLICT (nome) DO NOTHING",
          [settoreId, settoreNode.settore, areaId]
        );
        for (const nomeUfficio of settoreNode.uffici) {
          await pool.query(
            "INSERT INTO uffici (id, nome, livello, parent_id) VALUES ($1,$2,'ufficio',$3) ON CONFLICT (nome) DO NOTHING",
            [crypto.randomUUID(), nomeUfficio, settoreId]
          );
        }
      }
    }
  }

  // Seed sale: le sale comunali fisse, nell'ordine indicato. Solo se la tabella
  // è vuota (l'admin non le crea/elimina da pannello, solo configura email/messaggio).
  // "Sala Bernabò" ha solo_matrimoni=true: non compare nello step "In quale sala
  // vuoi prenotare?" della pagina principale, solo in /prenotazione-sale/matrimoni
  // (vedi listSaleGenerali/listSaleMatrimoni in lib/data.ts).
  const { rows: sl } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM sale"
  );
  if (sl[0].n === 0) {
    const saleSeed: { nome: string; soloMatrimoni?: boolean }[] = [
      { nome: "Sala Giunta" },
      { nome: "Sala Riunioni" },
      { nome: "Sala Consiliare" },
      { nome: "Sala degli Specchi" },
      { nome: "Sala dei Gelsi" },
      { nome: "Sala delle Colonne" },
      { nome: "Sala Bernabò", soloMatrimoni: true },
    ];
    for (let i = 0; i < saleSeed.length; i++) {
      await pool.query(
        `INSERT INTO sale (id, nome, ordine, solo_matrimoni) VALUES ($1,$2,$3,$4)
         ON CONFLICT (nome) DO NOTHING`,
        [crypto.randomUUID(), saleSeed[i].nome, i, saleSeed[i].soloMatrimoni ?? false]
      );
    }
  }

  // Admin iniziale: username "admin", password = ADMIN_PASSWORD (env).
  const { rows: u } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users"
  );
  if (u[0].n === 0) {
    // In produzione niente ripiego su "admin": un'installazione nuova senza
    // ADMIN_PASSWORD nel .env partirebbe con una password nota a chiunque.
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword && process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD non configurata: serve per creare l'admin iniziale");
    }
    const { salt, hash } = hashPassword(adminPassword || "admin");
    await pool.query(
      `INSERT INTO users (id, username, salt, hash, ruolo, can_edit_ufficiali, can_edit_non_ufficiali)
       VALUES ($1, 'admin', $2, $3, 'admin', true, true)`,
      [crypto.randomUUID(), salt, hash]
    );
  }
}
