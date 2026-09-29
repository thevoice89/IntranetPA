// Definizione centralizzata delle rotte dell'Intranet.
// Unica fonte di verità: usata sia dalla navigazione che dalle pagine.

export interface AppRoute {
  path: string;
  label: string;
  description: string;
  icon: string;
}

export const ROUTES = {
  home: {
    path: "/",
    label: "Home",
    description: "Panoramica dell'intranet aziendale",
    icon: "🏠",
  },
  comunicazioniUfficiali: {
    path: "/comunicazioni-ufficiali",
    label: "Comunicazioni Ufficiali",
    description: "Annunci e comunicazioni ufficiali dell'azienda",
    icon: "📢",
  },
  comunicazioniNonUfficiali: {
    path: "/comunicazioni-non-ufficiali",
    label: "Comunicazioni Non Ufficiali",
    description: "Bacheca informale, eventi e comunicazioni tra colleghi",
    icon: "💬",
  },
  comunicazioniRsu: {
    path: "/comunicazioni-rsu",
    label: "Comunicazioni RSU",
    description: "Comunicazioni della Rappresentanza Sindacale Unitaria",
    icon: "🤝",
  },
  comunicazioniSicurezza: {
    path: "/comunicazioni-sicurezza",
    label: "Sicurezza sul lavoro",
    description: "Comunicazioni sulla sicurezza sul lavoro",
    icon: "🦺",
  },
  comunicazioniEventi: {
    path: "/comunicazioni-eventi",
    label: "Eventi",
    description: "Comunicazioni su eventi e iniziative",
    icon: "🎉",
  },
  comunicazioniFormazione: {
    path: "/comunicazioni-formazione",
    label: "Notizie Formazione",
    description: "Notizie e novità pubblicate dalla sezione Formazione",
    icon: "🎓",
  },
  dashboardServizi: {
    path: "/dashboard-servizi",
    label: "Dashboard Strumenti",
    description: "Accesso rapido agli strumenti e alle applicazioni aziendali",
    icon: "🧩",
  },
  dashboardPortali: {
    path: "/dashboard-portali",
    label: "Dashboard Portali",
    description: "Accesso rapido ai portali online del Comune",
    icon: "🌐",
  },
  regolamenti: {
    path: "/regolamenti",
    label: "Regolamenti",
    description: "Regolamenti aziendali in PDF, consultabili online",
    icon: "📄",
  },
  cartaIntestata: {
    path: "/carta-intestata",
    label: "Carta Intestata",
    description: "Modelli, loghi e immagini ufficiali pronti da scaricare",
    icon: "📃",
  },
  formazione: {
    path: "/formazione",
    label: "Formazione",
    description:
      "Attività formative dei dipendenti, avvisi e opportunità, contributi dei colleghi",
    icon: "🎓",
  },
  formazioneAttivita: {
    path: "/formazione/le-mie-attivita",
    label: "Le mie attività formative",
    description: "Registra i corsi seguiti, le ore e gli attestati ricevuti",
    icon: "📋",
  },
  formazioneColleghi: {
    path: "/formazione/colleghi-per-colleghi",
    label: "Formazione dei colleghi per i colleghi",
    description:
      "Pillole formative, approfondimenti operativi e competenze condivise dai colleghi",
    icon: "🧑‍🏫",
  },
  formazioneAvvisi: {
    path: "/formazione/avvisi",
    label: "Avvisi e opportunità formative",
    description: "Iniziative di formazione interne ed esterne, aperte a tutti: pubblica il tuo avviso",
    icon: "📣",
  },
  rubrica: {
    path: "/rubrica",
    label: "Rubrica",
    description: "Rubrica telefonica: interni, uffici e contatti aziendali",
    icon: "📇",
  },
  procedure: {
    path: "/procedure",
    label: "Procedure",
    description: "Come si fa: servizio, ufficio e referente per ogni procedura",
    icon: "🗂️",
  },
  faq: {
    path: "/faq",
    label: "FAQ",
    description: "Domande frequenti sulle procedure e i servizi dell'ente",
    icon: "❓",
  },
  presenze: {
    path: "/presenze",
    label: "Presenze e Assenze",
    description: "Registra le tue assenze e consulta il calendario dell'ufficio",
    icon: "🗓️",
  },
  moduli: {
    path: "/moduli",
    label: "Moduli",
    description: "Moduli digitali da compilare online, divisi per ufficio",
    icon: "📝",
  },
  sondaggi: {
    path: "/sondaggi",
    label: "Sondaggi",
    description: "Sondaggi aperti a tutti i dipendenti",
    icon: "📊",
  },
  prenotazioneSale: {
    path: "/prenotazione-sale",
    label: "Prenotazione sale",
    description: "Prenota una sala comunale: Giunta, Riunioni, Consiliare o degli Specchi",
    icon: "🚪",
  },
  calendario: {
    path: "/calendario",
    label: "Calendario",
    description:
      "Gli eventi in programma: quelli inseriti dai colleghi e quelli fissati nelle comunicazioni",
    icon: "📅",
  },
  cerca: {
    path: "/cerca",
    label: "Cerca",
    description: "Cerca tra documenti, regolamenti e guide",
    icon: "🔍",
  },
  suggerimenti: {
    path: "/suggerimenti",
    label: "Suggerimenti e segnalazioni",
    description: "Invia un suggerimento o una segnalazione",
    icon: "💡",
  },
} as const satisfies Record<string, AppRoute>;

// Le 5 voci di comunicazione, raggruppate nella sidebar sotto un'unica voce
// "Comunicazioni" pieghevole (vedi components/layout/Sidebar.tsx). Restano
// singolarmente riordinabili/rinominabili/nascondibili da /admin/menu come le
// altre voci di NAV_ITEMS: il raggruppamento è solo visivo, la posizione del
// gruppo in sidebar segue la prima di queste 5 nell'ordine salvato.
export const GRUPPO_COMUNICAZIONI_PATHS: readonly string[] = [
  ROUTES.comunicazioniUfficiali.path,
  ROUTES.comunicazioniNonUfficiali.path,
  ROUTES.comunicazioniRsu.path,
  ROUTES.comunicazioniSicurezza.path,
  ROUTES.comunicazioniEventi.path,
  ROUTES.comunicazioniFormazione.path,
];

// Voci mostrate nella navigazione principale.
export const NAV_ITEMS: AppRoute[] = [
  ROUTES.comunicazioniUfficiali,
  ROUTES.comunicazioniNonUfficiali,
  ROUTES.comunicazioniRsu,
  ROUTES.comunicazioniSicurezza,
  ROUTES.comunicazioniEventi,
  ROUTES.comunicazioniFormazione,
  ROUTES.dashboardServizi,
  ROUTES.dashboardPortali,
  ROUTES.regolamenti,
  ROUTES.cartaIntestata,
  ROUTES.formazione,
  ROUTES.rubrica,
  ROUTES.procedure,
  ROUTES.faq,
  ROUTES.presenze,
  ROUTES.moduli,
  ROUTES.sondaggi,
  ROUTES.prenotazioneSale,
  ROUTES.calendario,
  ROUTES.suggerimenti,
];
