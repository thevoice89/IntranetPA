// Le tre sezioni "a blocchi" della homepage pubblica (solo news, i widget sono
// nella colonna laterale fissa, non riordinabile — vedi (site)/page.tsx), nell'ordine
// di default del codice. Riordinabili/rinominabili dall'admin in /admin/impostazioni
// con lo stesso meccanismo delle voci di menu (menu_ordine con menu="home", vedi
// lib/ordina-menu.ts e lib/etichette-menu.ts): "chiave" identifica il blocco, "label"
// è il testo mostrato sopra (section-label) finché l'admin non lo personalizza.
export interface SezioneHomeDef {
  chiave: string;
  label: string;
  icon: string;
}

export const SEZIONI_HOME_DEFAULT: SezioneHomeDef[] = [
  { chiave: "in-evidenza", label: "In evidenza", icon: "⭐" },
  { chiave: "cronologiche", label: "Ultime notizie", icon: "🗞️" },
  { chiave: "informali", label: "Bacheca informale", icon: "💬" },
  { chiave: "rsu", label: "RSU", icon: "🤝" },
  { chiave: "sicurezza", label: "Sicurezza sul lavoro", icon: "🦺" },
  { chiave: "formazione", label: "Notizie Formazione", icon: "🎓" },
];
