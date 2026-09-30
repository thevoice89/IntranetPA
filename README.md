# Intranet per enti pubblici

Portale intranet per i dipendenti di un ente pubblico, pensato per un Comune. Raccoglie in
un unico posto quello che di solito è sparso tra email, cartelle condivise e bacheche:
comunicazioni interne, moduli, prenotazione delle sale, rubrica, regolamenti, formazione e
presenze.

Gira su un server in rete locale (accesso via IP interno) oppure su una VPS dietro HTTPS.
Tutti i contenuti si gestiscono da un pannello di amministrazione, con permessi distinti per
ufficio.

> Questa repository contiene solo il codice. I riferimenti all'ente sono segnaposto
> ("Comune di Esempio"): vedi [Personalizzazione](#personalizzazione).

## Funzionalità

**Comunicazione**
- Comunicazioni ufficiali, non ufficiali, RSU, sicurezza sul lavoro ed eventi, con
  allegati, commenti, sondaggi collegati ed evidenza programmata.
- Calendario degli eventi e FAQ.
- Suggerimenti e segnalazioni dei dipendenti, con risposta via email o nell'area personale.

**Servizi**
- **Moduli digitali**: form personalizzabili per ufficio o documenti da scaricare, con
  notifica email per ogni compilazione e PDF delle risposte su carta intestata.
- **Sondaggi** aperti a tutti i dipendenti.
- **Prenotazione sale**: calendario settimanale, notifiche email e richieste di assistenza
  tecnica o informatica collegate alla prenotazione.
- **Rubrica** dei contatti interni, organizzata per ufficio, con click-to-call.
- **Regolamenti e procedure** in PDF, con ricerca nel testo dei documenti.
- **Carta intestata** e **dashboard** di collegamenti a strumenti e portali esterni.
- **Ricerca** trasversale su tutto il sito.

**Personale**
- **Presenze e assenze**, con filtro per ufficio. Sincronizzazione opzionale dalle
  timbrature di Sicraweb EVO (Maggioli).
- **Formazione**: attività formative personali con attestati, avvisi e opportunità,
  formazione tra colleghi, esportazione Excel.

**Amministrazione** (`/admin`)
- Gerarchia degli uffici su tre livelli (Area > Settore > Ufficio), con permessi per
  sezione che valgono a cascata sugli uffici sottostanti.
- Gestione utenti, impostazioni del sito (titolo, SMTP, ordine della home), statistiche e
  log delle attività (conservato 30 giorni).

## Tecnologie

| Componente | Scelta |
|---|---|
| Applicazione | Next.js 15 (App Router), React 19, TypeScript |
| Database | PostgreSQL 17 (schema creato e aggiornato automaticamente all'avvio) |
| Reverse proxy | Traefik v3 |
| Container | Docker multi-stage (`node:22-alpine`, utente non root) |
| Email | SMTP generico via `nodemailer` |
| PDF | `pdfkit` per la generazione, `pdf-parse` per la ricerca nel testo |

---

## Installazione

Requisiti: un server (o PC) con **Docker** e Docker Compose. La porta 80 deve essere libera.

### 1. Configurazione

```bash
git clone <url-della-repo> intranet
cd intranet
cp .env.example .env
```

Compila `.env`. I valori obbligatori sono:

| Variabile | A cosa serve | Come generarla |
|---|---|---|
| `POSTGRES_PASSWORD` | Password del database | Una stringa lunga e casuale |
| `ADMIN_PASSWORD` | Password dell'utente `admin`, creato al primo avvio | A tua scelta |
| `SESSION_SECRET` | Firma dei cookie di sessione | `openssl rand -hex 32` |
| `SYNC_TOKEN` | Autorizza le chiamate automatiche di sincronizzazione | `openssl rand -hex 32` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stabilità delle azioni del server tra un deploy e l'altro | `openssl rand -base64 32` |
| `APP_BASE_URL` | Indirizzo dell'intranet, usato nei link delle email | es. `http://192.168.1.10` |

Facoltativi:

- `SMTP_*`: server di posta per le notifiche. Configurabile anche dopo, da
  `/admin/impostazioni`. Se vuoto, le email vengono saltate senza errori.
- `SICRAWEB_*`: credenziali API fornite da Maggioli, per importare le presenze dalle
  timbrature (vedi sotto).

### 2. Avvio

```bash
docker compose up -d --build
```

Si avviano tre container: Traefik sulla porta 80, l'applicazione e PostgreSQL. Lo schema del
database viene creato al primo avvio.

L'intranet è su `http://IP_DEL_SERVER/`, il pannello di amministrazione su
`http://IP_DEL_SERVER/admin` (utente `admin`, password `ADMIN_PASSWORD`).

### 3. Primi passi nel pannello

1. **Impostazioni**: titolo e sottotitolo del sito, SMTP (con invio di prova), ordine delle
   sezioni in home.
2. **Uffici**: adatta l'organigramma. Al primo avvio ne viene caricato uno di esempio.
3. **Utenti**: crea gli account e assegna i permessi per sezione e per ufficio.
4. **Rubrica**, **moduli**, **sale**: inserisci i contenuti iniziali.

### Presenze da Sicraweb (facoltativo)

Con le variabili `SICRAWEB_*` compilate, le presenze del giorno si possono importare dalle
timbrature: a mano dal pannello (`/admin/presenze`), oppure con una chiamata pianificata:

```bash
curl -X POST -H "Authorization: Bearer <SYNC_TOKEN>" http://IP_DEL_SERVER/api/presenze/sync
```

Le righe inserite a mano non vengono mai sovrascritte dalla sincronizzazione.

### Deploy su VPS con HTTPS

Per esporre l'intranet su Internet dietro un Traefik con certificati Let's Encrypt e una
password condivisa davanti al sito, vedi [`deploy/vps/README.md`](deploy/vps/README.md). La
guida copre anche migrazione dei dati, backup notturni e messa in sicurezza.

### Sviluppo locale

```bash
npm install
npm run dev   # http://localhost:3000
```

Serve un PostgreSQL raggiungibile tramite `DATABASE_URL`.

---

## Personalizzazione

Al primo avvio l'intranet usa dei segnaposto ("Comune di Esempio", stemma e logo
generici). Si sostituiscono dal pannello, **senza toccare il codice né rifare la build**:
accedi a `/admin` come amministratore e apri **Impostazioni** (`/admin/impostazioni`).

| Cosa | Dove, in `/admin/impostazioni` |
|---|---|
| Nome dell'ente (titolo della scheda del browser, sottotitolo della home) | Ente e Intranet → *Nome dell'ente* |
| Titolo e sottotitolo della home | Ente e Intranet |
| Luogo nei PDF generati ("Esempio, <data>") | Ente e Intranet → *Luogo nei PDF* |
| Email dell'accoglienza ("Di chi è?") | Ente e Intranet → *Email dell'accoglienza* |
| Stemma (barra laterale) e logo (intestazione dei PDF) | Stemma e logo: carica un'immagine PNG, JPEG, WebP, GIF o SVG |
| Coordinate e link del meteo in home | Meteo in home |
| Nome e ordine delle sezioni della home | Sezioni della home |
| Invio email (SMTP) | Email in uscita |

Stemma e logo caricati finiscono nel volume `uploads` (quindi sopravvivono ai riavvii e
rientrano nel backup) e "Ripristina predefinito" torna ai file in `public/stemma.png`,
`public/logo.png` e `src/lib/pdf-assets/logo.png`. Le immagini vengono ridimensionate e
convertite in PNG dal browser al momento del caricamento; il server accetta solo PNG
(entro 2 MB e 2000 px per lato).

Ancora nel codice, da adattare solo se serve:

| Cosa | Dove |
|---|---|
| Organigramma iniziale | `src/types/index.ts` (`UFFICI_COMUNE_DEFAULT`) |
| Server usato dagli script di manutenzione | variabile `INTRANET_SSH_HOST` (`scripts/`) |

## Sicurezza

- Password con hash, sessioni firmate, blocco temporaneo dopo ripetuti tentativi di login
  falliti.
- Le chiamate automatiche di sincronizzazione usano un token dedicato (`SYNC_TOKEN`),
  distinto dal segreto che firma le sessioni.
- Intestazioni di sicurezza su tutte le risposte (`nosniff`, protezione dal clickjacking).
- Il `.gitignore` e il `.dockerignore` escludono `.env`, fogli Excel, CSV, dump del database
  e documenti di lavoro: i dati del personale non finiscono né nella repository né
  nell'immagine Docker.
- L'intranet tratta dati del personale (rubrica, presenze, segnalazioni). Se la ospiti su un
  servizio esterno, verifica con il DPO data center e accordo sul trattamento dei dati
  (art. 28 GDPR).

## Struttura

```
.
├── docker-compose.yml     # Traefik + app + PostgreSQL (rete locale)
├── Dockerfile
├── deploy/vps/            # stack, script e guida per il deploy su VPS con HTTPS
├── traefik/dynamic/       # configurazione di Traefik
├── scripts/               # strumenti di manutenzione da lanciare a mano
└── src/
    ├── app/(site)/        # sito dei dipendenti
    ├── app/admin/         # pannello di amministrazione
    ├── app/api/           # allegati, PDF, sincronizzazioni
    ├── components/
    ├── lib/               # accesso ai dati, autenticazione, email, PDF
    └── types/
```
