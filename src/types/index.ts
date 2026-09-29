// Tipi condivisi dell'applicazione.

// Le categorie sono personalizzabili dall'admin (tabella comunicazioni_categorie),
// quindi il valore è testo libero e non più un'unione fissa.
export type CategoriaComunicazione = string;

export interface CategoriaComunicazioneItem {
  id: string;
  nome: string;
}

export type TipoComunicazione =
  | "ufficiale"
  | "non_ufficiale"
  | "rsu"
  | "sicurezza"
  | "eventi"
  | "formazione";

export type TipoAllegato = "file" | "link";

// Allegato di una comunicazione, di un modulo o di un avviso di formazione (le
// chiavi genitore sono mutuamente esclusive, mai valorizzate più di una):
// stessa forma per riusare lo stesso componente di visualizzazione
// (Allegati.tsx) in ogni caso.
export interface Allegato {
  id: string;
  comunicazioneId?: string;
  moduloId?: string;
  avvisoFormazioneId?: string;
  tipo: TipoAllegato;
  etichetta: string;
  // Per i link: URL esterno (es. SharePoint). Per i file: "/api/file/<id>",
  // "/api/moduli-allegato/<id>" o "/api/formazione-avviso-allegato/<id>" a
  // seconda del genitore.
  url: string;
}

export interface Comunicazione {
  id: string;
  tipo: TipoComunicazione;
  titolo: string;
  estratto: string;
  corpo: string;
  autore: string;
  data: string; // ISO date "YYYY-MM-DD"
  categoria: CategoriaComunicazione;
  inEvidenza: boolean;
  // Data da cui la comunicazione va mostrata in evidenza in home anche se non è
  // più la più recente (es. un evento futuro annunciato con anticipo): null =
  // nessun promemoria impostato. Si somma (OR) a inEvidenza, non lo sostituisce
  // — vedi mostraInEvidenza() in lib/format.ts.
  promemoriaData: string | null; // ISO date "YYYY-MM-DD" o null
  // Data oltre la quale l'evidenza (da inEvidenza o da promemoriaData, qualunque
  // dei due l'abbia attivata) termina: null = nessuna scadenza, resta in evidenza
  // finché non la si toglie manualmente — vedi mostraInEvidenza() in lib/format.ts.
  evidenzaFine: string | null; // ISO date "YYYY-MM-DD" o null
  // Evento a cui la comunicazione si riferisce (es. un'assemblea, una scadenza).
  // Con eventoData valorizzata la comunicazione confluisce nel Calendario del
  // sito (vedi lib/calendario.ts), oltre a mostrare il riquadro "Quando" nella
  // propria pagina. Orari e luogo sono facoltativi: senza orari l'evento è di un
  // giorno intero.
  eventoData: string | null; // ISO date "YYYY-MM-DD" o null
  eventoOraInizio: string | null; // "HH:MM" o null
  eventoOraFine: string | null; // "HH:MM" o null
  eventoLuogo: string | null;
  // Se true, la comunicazione mostra i commenti dei visitatori ed è possibile inviarne di nuovi.
  commentiAbilitati: boolean;
  allegati?: Allegato[];
  // Sondaggio collegato (facoltativo, un solo sondaggio per comunicazione): l'unico
  // campo scrivibile è sondaggioId, null se non collegato. titolo/pubblicato sono
  // uno snapshot via JOIN (facoltativi: assenti quando si costruisce un input di
  // scrittura, es. in saveComunicazione), comodi per mostrare/nascondere il rimando
  // pubblico a /sondaggi/<id> senza una query separata.
  sondaggioId: string | null;
  sondaggioTitolo?: string | null;
  sondaggioPubblicato?: boolean | null;
  // Procedura/modulo/guida collegati (facoltativi, al più uno valorizzato):
  // stesso meccanismo di sondaggioId sopra, creato insieme al contenuto dal
  // rispettivo form ("Pubblica anche una comunicazione ufficiale"). titolo/
  // pubblicato sono snapshot via JOIN, come per il sondaggio; la guida non ha
  // un concetto di bozza quindi non ha un pubblicato corrispondente.
  proceduraId: string | null;
  proceduraTitolo?: string | null;
  proceduraPubblicato?: boolean | null;
  moduloId: string | null;
  moduloTitolo?: string | null;
  moduloPubblicato?: boolean | null;
  guidaId: string | null;
  guidaTitolo?: string | null;
  // Utente che ha creato la comunicazione (null = pregresso senza proprietario noto,
  // o pubblicata senza login da /comunicazioni-non-ufficiali): un editor non-admin
  // può modificare/eliminare solo le proprie, vedi canEditComunicazioneItem in
  // lib/auth.ts. L'admin bypassa sempre il controllo.
  creatoDa: string | null;
  // Numero di volte in cui la pagina di dettaglio pubblica è stata aperta
  // (incrementato in incrementaVisualizzazioni, lib/data.ts).
  visualizzazioni: number;
}

export interface CommentoComunicazione {
  id: string;
  comunicazioneId: string;
  // Titolo/tipo della comunicazione a cui appartiene: utili nell'elenco di
  // moderazione admin, che mostra i commenti di più comunicazioni insieme.
  comunicazioneTitolo: string;
  comunicazioneTipo: TipoComunicazione;
  autore: string;
  testo: string;
  creatoIl: string; // ISO datetime
  letta: boolean;
}

export type StatoServizio = "attivo" | "manutenzione" | "offline";

export interface Servizio {
  id: string;
  nome: string;
  descrizione: string;
  url: string;
  icona: string;
  categoria: string;
  stato: StatoServizio;
}

export type StatoPortale = "attivo" | "manutenzione" | "offline";

export interface Portale {
  id: string;
  nome: string;
  descrizione: string;
  url: string;
  icona: string;
  categoria: string;
  stato: StatoPortale;
}

export interface Regolamento {
  id: string;
  titolo: string;
  categoria: string;
  // URL del PDF servito inline: "/api/regolamento/<id>".
  fileUrl: string;
}

export interface CartaIntestata {
  id: string;
  titolo: string;
  mime: string;
  // "/api/carta-intestata/<id>" (download).
  fileUrl: string;
}

// Un frammento di testo attorno a un punto trovato dalla ricerca nel
// contenuto dei regolamenti; "match" indica se va evidenziato.
export interface SnippetParte {
  testo: string;
  match: boolean;
}

export interface RegolamentoRisultato extends Regolamento {
  snippetParti: SnippetParte[];
}

export type TipoGuida = "documento" | "link" | "video";

export interface GuidaMateriale {
  id: string;
  guidaId: string;
  titolo: string;
  tipo: TipoGuida;
  // documento -> "/api/guida-materiale/<id>"; link/video -> URL esterno.
  url: string;
}

export interface Guida {
  id: string;
  titolo: string;
  categoria: string;
  descrizione: string;
  materiali: GuidaMateriale[];
  // Collega non chi ha inserito la guida nel pannello, ma chi ha condiviso la
  // competenza (può essere un'altra persona): facoltativo, null = nessuna
  // attribuzione mostrata. autoreNome è uno snapshot via JOIN, come guidaTitolo
  // su Comunicazione — assente quando si costruisce un input di scrittura.
  autoreContattoId: string | null;
  autoreNome?: string | null;
}

// ===================== FORMAZIONE ======================================

// Attività formativa auto-dichiarata da un dipendente (corso seguito, ore,
// eventuale attestato). contattoId è sempre il proprio in creazione, mai
// scelto da un picker (vedi (site)/formazione/le-mie-attivita/actions.ts): a
// differenza di Contatto/Ufficio, qui non serve un id di scrittura separato
// dai campi. In modifica/eliminazione un record può essere toccato anche da
// chi ha canVedereFormazioneTutti (o admin), non solo dal proprietario — vedi
// requireAutorizzazioneScrittura in le-mie-attivita/actions.ts.
export interface FormazioneAttivita {
  id: string;
  contattoId: string;
  // Snapshot del nome (JOIN in lettura, comodo per le viste "dei miei
  // collaboratori" senza dover risolvere ogni volta il contatto).
  contattoNome?: string;
  descrizionePercorso: string;
  enteErogatore: string;
  dataCorso: string; // ISO date "YYYY-MM-DD"
  orePreviste: number;
  oreSvolte: number;
  certificazioneCompetenze: boolean;
  // Presenza; Webinar; E-learning — testo libero, non vincolato in DB: le
  // opzioni fisse sono solo nel <select> del form (vedi lib/formazione-opzioni.ts).
  modalitaFruizione: string;
  // Facoltativa (unico campo non obbligatorio della scheda): opzioni fisse in
  // lib/formazione-opzioni.ts, testo libero in DB come modalitaFruizione.
  areaTematica: string;
  // "/api/formazione-attestato/<id>" se presente, null = nessun attestato caricato.
  attestatoUrl: string | null;
  attestatoNomeOriginale: string | null;
}

// Avviso pubblicato liberamente da un dipendente nella bacheca "Avvisi e
// opportunità formative" (iniziative interne/esterne, materiali dei corsi):
// a differenza delle Comunicazioni (di cui faceva parte come tipo "formazione"
// fino a quando non è stata scorporata), qui può pubblicare QUALSIASI utente
// loggato, non solo chi ha un permesso dedicato — form volutamente minimo
// (titolo, descrizione, allegati/link), senza evidenza né date. autore è uno
// snapshot del nome al momento della pubblicazione (dalla rubrica se
// l'account è collegato, altrimenti lo username), stesso principio di
// Segnalazione.autore; creatoDa è l'id dell'utente proprietario, usato per
// permettere modifica/eliminazione solo a lui o all'admin (vedi
// (site)/formazione/avvisi/actions.ts).
export interface FormazioneAvviso {
  id: string;
  titolo: string;
  descrizione: string;
  autore: string;
  creatoDa: string | null;
  creatoIl: string; // ISO datetime
  allegati?: Allegato[];
}

export interface Contatto {
  id: string;
  nome: string;
  // Nodi della gerarchia uffici a cui il contatto appartiene (Area, Settore o
  // Ufficio, qualunque livello, anche più di uno): [] = nessuno assegnato.
  uffici: Ufficio[];
  ruolo: string;
  interno: string; // interno telefonico
  telefono: string; // numero diretto / esterno
  cellulare: string;
  email: string;
  note: string;
  // Origine del dato: "manuale" (inserito a mano).
  fonte: string;
}

// Dati privati per persona (mai pubblici, vedi anagrafica_privata in
// lib/db.ts): letti solo dal proprio account (user.contattoId) e da
// procedure lato server come Formazione. età è calcolata da dataNascita a
// ogni lettura, non memorizzata, così resta corretta senza manutenzione.
export interface AnagraficaPrivata {
  contattoId: string;
  categoriaLavoro: string;
  // "U" (uomo) / "D" (donna) / "" se non censito — stessa codifica del file
  // fornito dall'ufficio del personale.
  genere: string;
  dataNascita: string | null; // ISO "YYYY-MM-DD"
  eta: number | null;
}

export interface Procedura {
  id: string;
  titolo: string;
  descrizione: string;
  servizio: string; // il servizio che eroga la procedura
  // Nodo della gerarchia uffici che esegue la procedura (qualunque livello).
  ufficioId: string | null;
  ufficioNome: string;
  referente: string; // nome del referente
  referenteContatto: string; // email / telefono / interno del referente
  categoria: string;
  // Eventuale link di approfondimento (modulo, pagina, ecc.).
  url: string;
  pubblicato: boolean;
}

export interface Faq {
  id: string;
  domanda: string;
  risposta: string;
  categoria: string;
  // Procedura a cui è collegata (facoltativo): se presente, la FAQ compare
  // anche in fondo alla pagina di dettaglio di quella procedura.
  proceduraId: string | null;
  proceduraTitolo: string;
  pubblicato: boolean;
}

export interface Segnalazione {
  id: string;
  testo: string;
  // Nominativo obbligatorio scelto dalla rubrica: snapshot di rubrica.nome/email al
  // momento dell'invio (mai un JOIN live), così la segnalazione resta leggibile anche
  // se il contatto viene poi rinominato o eliminato. autore resta nullable solo per le
  // segnalazioni storiche inviate prima di questo vincolo.
  autore: string | null;
  autoreEmail: string;
  contattoId: string | null;
  // Valorizzato solo se il mittente era loggato (account staff) al momento dell'invio:
  // solo informativo in /admin/segnalazioni, non cambia come arriva la risposta
  // (sempre via email, vedi rispondiSegnalazione in app/admin/actions.ts).
  userId: string | null;
  letta: boolean;
  rispostaTesto: string | null;
  rispostaData: string | null; // ISO datetime
  rispostaEmailInviataIl: string | null; // ISO datetime, null finché non riesce un invio
  creatoIl: string; // ISO datetime
}

// Pacco registrato dalla reception ("Di chi è?"): resta "in attesa" finché
// rivendicatoIl è null. rivendicatoNome/rivendicatoEmail sono uno snapshot del
// contatto rubrica al momento della dichiarazione (stesso principio di
// Segnalazione.autore/autoreEmail), leggibile anche se il contatto viene poi
// rinominato o eliminato dalla rubrica.
export interface Pacco {
  id: string;
  dataArrivo: string; // YYYY-MM-DD
  mittente: string;
  descrizione: string;
  hasFoto: boolean; // true se è stata allegata una foto, servita da /api/pacco-foto/[id]
  creatoDa: string | null;
  rivendicatoDa: string | null; // contatto rubrica che ha dichiarato "è mio"
  rivendicatoNome: string | null;
  rivendicatoEmail: string | null;
  rivendicatoIl: string | null; // ISO datetime, null finché nessuno lo rivendica
  creatoIl: string; // ISO datetime
}

export interface RisultatoRicerca {
  tipo:
    | "Regolamento"
    | "Formazione"
    | "Documento"
    | "Procedura"
    | "FAQ"
    | "Contatto"
    | "Modulo"
    | "Sondaggio"
    | "Comunicazione"
    | "Servizio"
    | "Portale"
    | "Carta intestata";
  titolo: string;
  sottotitolo: string;
  href: string;
  // Solo per i risultati di tipo Contatto: stato di oggi, mostrato come badge colorato.
  presenza?: "presente" | "assente" | "smartworking";
}

// Stato di una giornata in presenze_assenze: assente (rosso) o smart working
// (arancione). L'assenza di uno stato (nessuna riga) significa "presente".
export type StatoPresenza = "assente" | "smartworking";

export type Ruolo = "admin" | "editor";

export interface User {
  id: string;
  username: string;
  ruolo: Ruolo;
  canEditUfficiali: boolean;
  canEditNonUfficiali: boolean;
  canEditRsu: boolean;
  // Comunicazioni di Sicurezza sul lavoro: pubblicabili solo da utenti profilati
  // (mai da un form pubblico, a differenza delle non ufficiali), stesso modello
  // a flag booleano di canEditUfficiali/Rsu.
  canEditSicurezza: boolean;
  // Comunicazioni Eventi: stesso modello a flag booleano di canEditUfficiali/Rsu/Sicurezza.
  canEditEventi: boolean;
  // Comunicazioni Notizie Formazione: stesso modello a flag booleano di canEditUfficiali/Rsu/Sicurezza/Eventi.
  canEditFormazione: boolean;
  // Permesso di creare/modificare Sondaggi (vedi canManageSondaggi in lib/auth.ts):
  // indipendente da uffici, i Sondaggi non hanno un modello a permessi-per-ufficio.
  canManageSondaggi: boolean;
  // Permessi granulari per le sezioni non legate a comunicazioni/moduli/sondaggi
  // (vedi funzioni omonime in lib/auth.ts). Default false: un editor non vede/non
  // tocca nulla finché non gli viene concesso esplicitamente da "Utenti".
  canEditRubrica: boolean;
  canEditRegolamenti: boolean;
  canEditProcedure: boolean;
  canEditGuide: boolean;
  canEditCartaIntestata: boolean;
  canManageSegnalazioni: boolean;
  // Permesso di gestire "Di chi è?" (pacchi in reception, vedi canManagePacchi
  // in lib/auth.ts): stesso modello a flag booleano di canManageSegnalazioni.
  canManagePacchi: boolean;
  // Permesso piatto, indipendente dalla gerarchia dei responsabili (vedi
  // lib/gerarchia.ts): vede le attività formative di TUTTI i dipendenti, non
  // solo dei propri sottoposti — stesso modello di canManageSegnalazioni/Pacchi.
  canVedereFormazioneTutti: boolean;
  // Permesso di esportare la tabella Formazione in Excel (vedi
  // canEsportareFormazione in lib/auth.ts): pensato per un'utenza dedicata
  // all'estrazione dati, indipendente dagli altri permessi Formazione.
  canEsportareFormazione: boolean;
  // Id degli uffici assegnati (rilevante solo per il ruolo editor: vedi
  // canManageUfficio in lib/auth.ts). L'admin bypassa sempre il controllo.
  uffici: string[];
  // Contatto della rubrica a cui è collegato l'account (opzionale): fornisce
  // nome ed ufficio senza duplicare l'anagrafica sull'utente di login (vedi
  // saluto "Ciao <nome>" in admin/(panel)/page.tsx e layout.tsx). null = nessun
  // collegamento, si mostra lo username.
  contattoId: string | null;
  // Versione corrente delle sessioni dell'utente (vedi makeToken in
  // lib/auth.ts): incrementata a ogni cambio password, invalida i cookie
  // emessi prima.
  sessioneVersione: number;
}

// ===================== MODULI ==========================================

// Elenco canonico della gerarchia uffici, usato per il matching esatto dei
// permessi. Indipendente dal testo libero storico già usato in Procedura/Contatto
// (colonna `ufficio`, non più scritta dal codice nuovo — vedi Procedura.ufficioId).
export type LivelloUfficio = "area" | "settore" | "ufficio";

export interface Ufficio {
  id: string;
  nome: string;
  livello: LivelloUfficio;
  // null solo per le Aree (radice dell'albero).
  parentId: string | null;
}

// Responsabile di un nodo dell'organigramma (tabella uffici_responsabili): un
// contatto della rubrica, non un account: chi non ha ancora un login resta
// comunque censito. Solo id + nome, quanto basta a mostrarlo e a risolvere i
// permessi — non un Contatto intero, che si porterebbe dietro i propri uffici.
export interface ResponsabileUfficio {
  id: string; // id del contatto in rubrica
  nome: string;
}

// Struttura ufficiale Area -> Settore -> Ufficio del Comune, usata per popolare
// la tabella `uffici` al primo avvio su un DB vuoto (in seguito la gerarchia è
// comunque gestibile liberamente dall'admin in "Moduli"). Fonte: organigramma
// comunale (Segretario Generale > Aree > Settori > Uffici).
export interface UfficioSeedSettore {
  settore: string;
  uffici: string[];
}

export interface UfficioSeedArea {
  area: string;
  settori: UfficioSeedSettore[];
}

export const UFFICI_COMUNE_DEFAULT: UfficioSeedArea[] = [
  {
    area: "Risorse e cura del cittadino",
    settori: [
      {
        settore: "Affari Generali",
        uffici: [
          "Segreteria, Protocollo e Archivio",
          "Gare e Contratti, Trasparenza e Anticorruzione",
          "Gestione del Personale",
        ],
      },
      {
        settore: "Risorse Finanziarie e Digitali",
        uffici: [
          "Bilancio, Programmazione finanziaria ed economato",
          "Tributi",
          "Controllo di gestione, società ed enti partecipati",
          "Provveditorato, ICT e transizione digitale",
        ],
      },
      {
        settore: "Comunità Inclusiva e Cura del Cittadino",
        uffici: [
          "Assistenza sociale",
          "Servizi abitativi pubblici",
          "Servizi educativi e scolastici",
          "Politiche Giovanili",
        ],
      },
      {
        settore: "Risorse Culturali e Biblioteca",
        uffici: [
          "Biblioteca",
          "Cultura e Servizi Museali",
          "Turismo",
          "Sport",
          "Comunicazione",
        ],
      },
      {
        settore: "Servizi al Cittadino",
        uffici: ["Sportello Polifunzionale", "Servizi demografici e cimiteriali", "Messi e Notifiche"],
      },
    ],
  },
  {
    area: "Territorio, gestione e sviluppo della città",
    settori: [
      {
        settore: "Pianificazione, Sviluppo e Sostenibilità Urbana",
        uffici: [
          "Pianificazione territoriale e rigenerazione urbana",
          "Edilizia privata, Sportello Unico per l'Edilizia (S.U.E.)",
          "Commercio, Sportello Unico Attività Produttive (S.U.A.P.)",
          "Ambiente, ecologia e bonifiche",
        ],
      },
      {
        settore: "Patrimonio, Opere e Infrastrutture",
        uffici: [
          "Lavori e opere pubbliche",
          "Edilizia scolastica e infrastrutture sportive",
          "Trasporti, mobilità sostenibile e parcheggi pubblici",
          "Manutenzione verde pubblico, parchi e giardini",
          "Manutenzione patrimonio immobiliare e infrastrutture",
          "Sostenibilità energetica",
        ],
      },
    ],
  },
  {
    area: "Prevenzione e sicurezza",
    settori: [
      { settore: "Corpo di Polizia Locale", uffici: [] },
      { settore: "Protezione Civile", uffici: [] },
    ],
  },
];

export type TipoCampoModulo =
  | "testo"
  | "testo_lungo"
  | "numero"
  | "data"
  | "ora"
  | "email"
  | "telefono"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "testo_statico";

export const TIPI_CAMPO_MODULO: { value: TipoCampoModulo; label: string }[] = [
  { value: "testo", label: "Testo breve" },
  { value: "testo_lungo", label: "Testo lungo" },
  { value: "numero", label: "Numero" },
  { value: "data", label: "Data" },
  { value: "ora", label: "Orario" },
  { value: "email", label: "Email" },
  { value: "telefono", label: "Telefono" },
  { value: "select", label: "Menu a scelta (select)" },
  { value: "radio", label: "Scelta singola (radio)" },
  { value: "checkbox", label: "Casella di conferma (sì/no)" },
  { value: "file", label: "Allegato (file)" },
  { value: "testo_statico", label: "Testo informativo (nessuna risposta)" },
];

export interface ModuloCampo {
  id: string;
  moduloId: string;
  // Per tipo "testo_statico": HTML sanificato lato server, va reso con
  // dangerouslySetInnerHTML. Per tutti gli altri tipi: testo semplice.
  etichetta: string;
  tipo: TipoCampoModulo;
  // Solo per select/radio: una scelta per riga.
  opzioni: string[];
  obbligatorio: boolean;
}

// "form": domande online, risposte raccolte in "Moduli ricevuti" (comportamento
// storico). "documento": nessuna domanda né compilazione — solo un file già
// pronto (es. Word) caricato come allegato e scaricabile dalla pagina pubblica.
// "pdf": domande online come "form", ma la compilazione non viene salvata da
// nessuna parte né notificata — chi compila scarica subito un PDF in carta
// intestata con le risposte, da consegnare/firmare fuori dall'Intranet (utile
// per moduli che oggi sono un Word da stampare a mano).
// Fissato alla creazione: l'editor non permette di cambiarlo in modifica.
export type TipoModulo = "form" | "documento" | "pdf";

export interface Modulo {
  id: string;
  titolo: string;
  // HTML sanificato lato server (grassetto/corsivo/elenchi/link): va reso con
  // dangerouslySetInnerHTML, mai interpolato come testo semplice.
  descrizione: string;
  ufficioId: string;
  ufficioNome: string;
  pubblicato: boolean;
  tipo: TipoModulo;
  // Email a cui notificare l'arrivo di una nuova compilazione (vuota = nessuna notifica).
  emailNotifica: string;
  // Solo per tipo "pdf" (ignorati per "form"/"documento"): a chi è indirizzata
  // la lettera generata (es. "Servizio Gestione del Personale") e, se non
  // vuoto, il destinatario "per conoscenza"; pdfCorpo è il testo in prosa del
  // PDF con placeholder {{Etichetta campo}} sostituiti dal valore compilato
  // (etichette duplicate abbinate in ordine di comparsa); pdfNota è il testo
  // facoltativo mostrato piccolo a piè di pagina.
  pdfDestinatario: string;
  pdfDestinatarioPc: string;
  pdfCorpo: string;
  pdfNota: string;
  campi: ModuloCampo[];
  allegati?: Allegato[];
  // Utente che ha creato il modulo (null = pregresso senza proprietario noto): un
  // editor non-admin può modificare/eliminare solo i propri, vedi
  // canManageModuloItem in lib/auth.ts. L'admin bypassa sempre il controllo.
  creatoDa: string | null;
}

// ===================== SONDAGGI ==========================================
// Stessa forma di ModuloCampo/Modulo (stesso editor "una pagina sola" stile
// Google Moduli, stesso set di tipi TipoCampoModulo), ma senza ufficio/email di
// notifica: gestibile da chi ha il permesso canManageSondaggi (vedi
// lib/auth.ts), non un modello a permessi-per-ufficio. Pubblicato = visibile e
// compilabile da tutti su /sondaggi — vedi lib/db.ts per lo schema.
export interface SondaggioCampo {
  id: string;
  sondaggioId: string;
  etichetta: string;
  tipo: TipoCampoModulo;
  opzioni: string[];
  obbligatorio: boolean;
}

export interface Sondaggio {
  id: string;
  titolo: string;
  descrizione: string;
  pubblicato: boolean;
  campi: SondaggioCampo[];
  // Utente che ha creato il sondaggio (null = pregresso senza proprietario noto): un
  // editor non-admin può modificare/eliminare solo i propri, vedi
  // canManageSondaggioItem in lib/auth.ts. L'admin bypassa sempre il controllo.
  creatoDa: string | null;
}

// Compilazione pubblica di un sondaggio: stessa forma di ModuloCompilazione
// (riusa ModuloRisposta/ModuloAllegato sotto, identici), senza ufficio.
export interface SondaggioCompilazione {
  id: string;
  sondaggioId: string;
  sondaggioTitolo: string;
  nomeCompilatore: string | null;
  emailCompilatore: string | null;
  letta: boolean;
  creatoIl: string; // ISO datetime
  risposte: ModuloRisposta[];
}

export interface ModuloAllegato {
  id: string;
  rispostaId: string;
  // "/api/moduli-compilazione-file/<id>" (download protetto).
  url: string;
  fileNameOriginale: string;
}

export interface ModuloRisposta {
  id: string;
  campoId: string | null;
  etichetta: string;
  tipo: TipoCampoModulo;
  valore: string;
  allegato: ModuloAllegato | null;
}

export interface ModuloCompilazione {
  id: string;
  moduloId: string;
  moduloTitolo: string;
  ufficioId: string;
  ufficioNome: string;
  nomeCompilatore: string | null;
  emailCompilatore: string | null;
  letta: boolean;
  creatoIl: string; // ISO datetime
  risposte: ModuloRisposta[];
}

// ===================== STATISTICHE MODULO ==============================
export interface StatisticaOpzione {
  valore: string;
  conteggio: number;
  percentuale: number; // 0-100, arrotondata
}

export interface StatisticaCampo {
  // null per risposte di un campo ormai eliminato dal modulo (solo snapshot storico).
  campoId: string | null;
  etichetta: string;
  tipo: TipoCampoModulo;
  risposteTotali: number;
  // Valorizzato solo per select/radio/checkbox: conteggio per opzione.
  opzioni: StatisticaOpzione[] | null;
  // Valorizzato per gli altri tipi: elenco delle risposte individuali
  // (per "file", il nome dell'allegato).
  valori: string[] | null;
}

export interface StatisticheModulo {
  moduloId: string;
  moduloTitolo: string;
  ufficioNome: string;
  totaleCompilazioni: number;
  campi: StatisticaCampo[];
}

export interface StatisticheSondaggio {
  sondaggioId: string;
  sondaggioTitolo: string;
  totaleCompilazioni: number;
  campi: StatisticaCampo[];
}

// ===================== PRENOTAZIONE SALE ================================
// Le 4 sale sono fisse (seed in lib/db.ts), non creabili/eliminabili da pannello:
// l'admin configura solo email/messaggio di notifica per sala.
export interface Sala {
  id: string;
  nome: string;
  // Destinatario a cui inoltrare via email ogni nuova prenotazione di questa sala
  // (vuoto = nessuna notifica, stesso principio di Modulo.emailNotifica).
  emailNotifica: string;
  // Testo personalizzato inserito nell'email di notifica, oltre ai dettagli
  // (data/orario/richiedente) aggiunti automaticamente — vedi inviaNotificaPrenotazione
  // in lib/mail.ts.
  messaggioNotifica: string;
  // Interruttore "sala non prenotabile" (es. sala dismessa, fuori uso a tempo
  // indeterminato): se true, la sala sparisce dalla scelta nella pagina pubblica
  // (listSaleGenerali/listSaleMatrimoni) e ogni tentativo di prenotazione viene
  // rifiutato lato server. Diverso da BloccoSala sotto, che inibisce singoli slot
  // orari invece dell'intera sala.
  bloccata: boolean;
}

export interface PrenotazioneSala {
  id: string;
  salaId: string;
  salaNome: string;
  data: string; // ISO date "YYYY-MM-DD"
  oraInizio: string; // "HH:MM"
  oraFine: string; // "HH:MM"
  // Nominativo obbligatorio scelto dalla rubrica: snapshot di rubrica.nome/email al
  // momento della prenotazione, stesso principio di Segnalazione.autore/autoreEmail.
  contattoId: string | null;
  richiedente: string;
  richiedenteEmail: string;
  note: string;
  // Richieste facoltative segnalate in fase di prenotazione: se true, inviano una
  // notifica separata ai destinatari configurati in /admin/prenotazioni-sale (vedi
  // inviaNotificaAssistenza in lib/mail.ts). Il dettaglio ("cosa serve") è
  // significativo solo quando il flag corrispondente è true.
  assistenzaTecnica: boolean;
  assistenzaTecnicaDettaglio: string;
  assistenzaInformatica: boolean;
  assistenzaInformaticaDettaglio: string;
  creatoIl: string; // ISO datetime
}

// Slot orario (stessa granularità di PrenotazioneSala: data + ora_inizio/ora_fine)
// che l'admin ha reso non prenotabile per QUESTA sala, senza doverne indicare il
// motivo — vedi /admin/prenotazioni-sale/[salaId]. Diverso da Sala.bloccata sopra,
// che inibisce l'intera sala invece di singoli orari. Controllato sia lato
// calendario pubblico (celle non cliccabili) sia lato server in
// data.creaPrenotazioneSala (autoritativo).
export interface BloccoSala {
  id: string;
  salaId: string;
  salaNome: string;
  data: string; // ISO date "YYYY-MM-DD"
  oraInizio: string; // "HH:MM"
  oraFine: string; // "HH:MM"
  creatoIl: string; // ISO datetime
}

// ===================== CALENDARIO EVENTI ===============================
// Evento inserito dalla sezione pubblica /calendario cliccando un giorno
// (tabella eventi_calendario). Orari e luogo facoltativi: senza ora di inizio è
// un evento di un giorno intero, come per gli eventi delle comunicazioni.
export interface EventoCalendario {
  id: string;
  titolo: string;
  data: string; // ISO date "YYYY-MM-DD"
  oraInizio: string | null; // "HH:MM" o null (giorno intero)
  oraFine: string | null; // "HH:MM" o null
  luogo: string;
  descrizione: string;
  // Chi l'ha inserito, scelto dalla rubrica: contattoId può diventare null se il
  // contatto viene poi eliminato, inseritoDa resta come snapshot del nome.
  contattoId: string | null;
  inseritoDa: string;
  // Sala comunale in cui si svolge l'evento (facoltativa): indicandola, la sala
  // risulta occupata in Prenotazione sale per l'orario dell'evento, senza doverla
  // prenotare a parte. prenotazioneId è la prenotazione così generata, e viene
  // eliminata insieme all'evento; è null se non è stata scelta una sala o se la
  // prenotazione è già stata cancellata dalla sua sezione. Il collegamento è a
  // senso unico: una prenotazione fatta da Prenotazione sale non crea un evento.
  salaId: string | null;
  salaNome: string | null;
  prenotazioneId: string | null;
  creatoIl: string; // ISO datetime
}

// Provenienza di una riga del calendario: "calendario" = evento inserito dagli
// utenti nella sezione (tabella eventi_calendario), "comunicazione" = evento
// fissato nei campi evento_* di una comunicazione, che confluisce nel calendario
// in sola lettura (si modifica dalla comunicazione, vedi lib/calendario.ts).
export type OrigineVoceCalendario = "calendario" | "comunicazione";

// Riga del calendario normalizzata, indipendente dalla provenienza: è la forma
// con cui il calendario, l'elenco dei prossimi eventi e il widget in home
// mostrano indifferentemente eventi propri ed eventi delle comunicazioni.
export interface VoceCalendario {
  // Id dell'evento o della comunicazione di origine: unico solo a parità di
  // origine, quindi come chiave React va usato `${origine}-${id}`.
  id: string;
  origine: OrigineVoceCalendario;
  titolo: string;
  data: string; // ISO date "YYYY-MM-DD"
  oraInizio: string | null; // "HH:MM" o null (giorno intero)
  oraFine: string | null; // "HH:MM" o null
  luogo: string;
  // Descrizione dell'evento, oppure l'estratto della comunicazione di origine.
  dettaglio: string;
  // Chi ha inserito l'evento, oppure l'autore della comunicazione.
  autore: string;
  // Vero se l'evento occupa una sala comunale (vedi EventoCalendario.salaId):
  // serve solo a segnalarlo a video, il luogo è già in `luogo`.
  salaPrenotata: boolean;
  // Link alla comunicazione di origine; null per gli eventi inseriti nel calendario.
  href: string | null;
}

// Una riga per azione pubblica senza login (prenotazioni sale, segnalazioni,
// commenti, comunicazioni non ufficiali, moduli/sondaggi, presenze): vedi
// lib/log-attivita.ts. Visibile solo in /admin/log-attivita, retention 30 giorni.
export interface LogAttivita {
  id: string;
  quando: string; // ISO datetime
  area: string; // es. "prenotazione_sala", "segnalazione", "commento"...
  azione: string; // es. "crea", "elimina", "compila"
  descrizione: string; // riga leggibile già pronta per la UI
  ip: string;
}

// Forma standard delle risposte API.
export interface ApiResponse<T> {
  data: T;
}

// Categorie di default usate per popolare la tabella comunicazioni_categorie
// al primo avvio (in seguito sono gestibili dall'admin).
export const CATEGORIE_COMUNICAZIONE_DEFAULT: string[] = [
  "Risorse Umane",
  "IT",
  "Direzione",
  "Sicurezza",
  "Eventi",
  "Generale",
];

export const STATI_SERVIZIO: StatoServizio[] = ["attivo", "manutenzione", "offline"];

export const STATI_PORTALE: StatoPortale[] = ["attivo", "manutenzione", "offline"];

// ===================== MENU (ordinamento) ==============================
// "home" non è un vero menu di navigazione: riusa la stessa tabella/meccanismo di
// ordinamento (menu_ordine) per le sezioni della homepage (vedi lib/home-sezioni.ts).
export type MenuId = "pubblico" | "admin" | "home";
