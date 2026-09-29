# Intranet Aziendale

Portale intranet per un ente pubblico (es. un Comune): comunicazioni interne, moduli
digitali, prenotazione sale, rubrica telefonica, regolamenti consultabili e altro. Pensato
per girare su rete locale (accesso via IP interno, solo HTTP) oppure su una VPS dietro
Traefik con HTTPS.

Questa repository contiene solo il codice: nessun dato, documento o configurazione di
un'installazione reale. I riferimenti all'ente sono segnaposto da personalizzare (vedi
[Personalizzazione](#personalizzazione)).

## Stack

- **App**: Next.js 15 (App Router, TypeScript, React 19) — output `standalone`
- **Database**: PostgreSQL 17 — fonte di verità per tutti i contenuti (nessun mock in produzione)
- **Reverse Proxy**: Traefik v3 (file provider, porta 80)
- **Container**: Docker multi-stage (`node:22-alpine`, utente non-root)
- **Email**: SMTP generico via `nodemailer` (configurabile da `/admin/impostazioni` o da env)
- **PDF**: `pdf-parse` (estrazione testo per la ricerca full-text sui regolamenti) e
  `pdfkit` (generazione PDF in carta intestata delle compilazioni moduli)

## Funzionalità principali

- **Comunicazioni**: ufficiali, non ufficiali e RSU, con commenti, sondaggi collegati,
  allegati, promemoria di evidenza programmata
- **Moduli digitali**: form personalizzabili per ufficio o documenti scaricabili, con
  notifica email per compilazione e generazione PDF delle risposte ricevute
- **Sondaggi**: aperti a tutti i dipendenti, editor unificato con Moduli
- **Prenotazione sale**: calendario settimanale, notifiche email, richieste di assistenza
  tecnica/informatica
- **Rubrica telefonica**: contatti interni gestiti dal pannello admin, click-to-call
- **Regolamenti e Procedure**: consultazione PDF con ricerca full-text nel contenuto
- **Presenze**: registro assenze con filtro per ufficio
- **Segnalazioni**: dai dipendenti, con risposta admin via email o area personale
- **Gerarchia uffici** (Area > Settore > Ufficio) con permessi granulari a cascata per
  ogni sezione amministrabile (comunicazioni, moduli, rubrica, regolamenti, procedure,
  guide, carta intestata, segnalazioni)
- **Pannello admin** (`/admin`) con statistiche, gestione utenti/permessi, impostazioni
  sito (titolo, SMTP, ordine home) e log attività (30 giorni, sola visualizzazione admin)

## Struttura

```
.
├── Dockerfile                # Build multi-stage dell'app Next.js
├── docker-compose.yml        # traefik + intranet + db
├── deploy/vps/               # Stack e script per il deploy su una VPS (vedi il suo README)
├── .env.example               # Variabili d'ambiente (copiare in .env)
├── traefik/dynamic/          # Config router/service di Traefik
└── src/
    ├── app/
    │   ├── (site)/            # Pagine pubbliche (comunicazioni, moduli, rubrica, ...)
    │   ├── admin/(panel)/     # Pannello amministrazione (dietro login)
    │   └── api/               # Route handler (file allegati, PDF, sync rubrica, ...)
    ├── components/
    │   ├── admin/             # Editor e picker usati nel pannello admin
    │   ├── layout/            # Sidebar, toggle tema, dimensione testo
    │   └── ui/                 # Componenti condivisi (card, allegati, rich text, ...)
    ├── lib/                    # Accesso dati (Postgres), auth, email, PDF, utility
    └── types/index.ts          # Modelli dati condivisi
```

## Sviluppo locale (senza Docker)

```bash
npm install
npm run dev   # http://localhost:3000
```

Serve comunque un'istanza PostgreSQL raggiungibile via `DATABASE_URL` (lo schema viene
creato automaticamente al primo avvio, idempotente — vedi `src/lib/db.ts`).

## Avvio in produzione (rete locale)

1. `cp .env.example .env` e personalizzare le variabili (in particolare
   `SESSION_SECRET` e `ADMIN_PASSWORD`, obbligatorie in produzione,
   `SYNC_TOKEN`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, credenziali PostgreSQL).
2. `docker compose up -d --build`
3. Accesso: `http://IP_DELLA_VM/` (pannello admin su `/admin`)

Traefik espone solo la porta 80 (nessun dominio/HTTPS: uso su rete locale).

Per il deploy su una VPS con HTTPS vedi [`deploy/vps/README.md`](deploy/vps/README.md).

## Personalizzazione

I riferimenti all'ente sono segnaposto. Da adattare prima dell'uso:

| Cosa | Dove |
|---|---|
| Nome dell'ente ("Comune di Esempio") | `src/app/layout.tsx`, `src/app/(site)/page.tsx`, `/admin/impostazioni` |
| Stemma e logo | `public/stemma.png`, `public/logo.png`, `src/lib/pdf-assets/logo.png` |
| Luogo nei PDF generati ("Esempio, <data>") | `src/lib/modulo-pdf.ts` |
| Email dell'accoglienza | `src/lib/mail.ts` (`EMAIL_ACCOGLIENZA`) |
| Coordinate e link del meteo | `src/lib/meteo.ts`, `src/app/(site)/page.tsx` (`METEO_URL`) |
| Organigramma iniziale (Area > Settore > Ufficio) | `src/types/index.ts` (`UFFICI_COMUNE_DEFAULT`) |
| Integrazione presenze Sicraweb | variabili `SICRAWEB_*` in `.env` |
| Server usato dagli script locali | variabile `INTRANET_SSH_HOST` (`scripts/`) |
