# Deploy dell'Intranet su una VPS

Procedura per portare l'Intranet da un server in rete locale a una VPS esposta
su Internet, con HTTPS.

Si presume che sulla VPS giri già un **Traefik** condiviso con altri servizi:
in `network_mode: host` (tiene lui le porte 80/443), con il **docker provider**
(`exposedbydefault=false`) e un resolver ACME chiamato `letsencrypt`.
L'Intranet non installa un proprio proxy: si aggancia a quello esistente con le
label di `docker-compose.yml`.

L'accesso pubblico è protetto da una **basic auth** di Traefik (password
condivisa dai dipendenti), in aggiunta al login del pannello `/admin`.

Negli esempi: `IP_DEL_SERVER` è il server di origine in rete locale,
`IP_DELLA_VPS` la VPS, `intranet.example.it` l'indirizzo pubblico.

---

## 1. Configurazione

In locale: `cp deploy/vps/env.esempio deploy/vps/.env` e compilarlo.

Segreti da generare:

```bash
openssl rand -hex 32      # SESSION_SECRET
openssl rand -base64 32   # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
```

Password condivisa (l'hash va scritto **con i `$` raddoppiati**, vedi §6):

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbB dipendenti 'LA_PASSWORD' | sed 's/\$/$$/g'
```

Le credenziali SMTP si possono copiare dal `.env` del server di origine.

## 2. Backup dei dati dal server di origine

```bash
SRC=utente@IP_DEL_SERVER bash deploy/vps/1-backup-dati.sh
```

Produce `backup-intranet-AAAAMMGG-HHMM/` con `intranet-db.sql` e
`uploads.tar.gz`, verificando che il dump non sia troncato.

## 3. Deploy sulla VPS

```bash
VM=root@IP_DELLA_VPS bash deploy/vps/2-ripristina-su-vm.sh backup-intranet-AAAAMMGG-HHMM
```

Sincronizza il progetto in `/opt/intranet`, avvia il solo database, ripristina
il dump (con le foreign key disattivate durante il caricamento — un
`psql < dump.sql` secco salterebbe in silenzio tutti i dati dopo il primo
errore), ripristina il volume degli upload, poi builda e avvia app + db.

Traefik rileva il nuovo container dalle label e chiede il certificato a
Let's Encrypt entro pochi secondi.

## 4. Verifica

```bash
curl -I https://intranet.example.it                              # atteso 401
curl -I -u dipendenti:LA_PASSWORD https://intranet.example.it    # atteso 200
curl -I http://intranet.example.it                               # atteso 308 -> https
```

Poi da browser, con la password condivisa:

- home, comunicazioni, allegati (conferma che il volume uploads è arrivato);
- `/admin` → login → statistiche e log attività;
- ricerca full-text nei regolamenti (esercita `pdf-parse` nell'immagine);
- PDF di una compilazione modulo (esercita `pdfkit`);
- calendario e prenotazione sale: **controllare gli orari** (il container resta
  in UTC, di proposito — vedi §6).

## 5. Messa in sicurezza e backup

Da fare **dopo** che l'accesso via chiave SSH è confermato funzionante:

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh
```

Backup notturno (DB + uploads, rotazione 14 giorni):

```bash
VM=root@IP_DELLA_VPS bash deploy/vps/3-backup-automatico.sh
```

## 6. Trappole note

1. **`$` negli hash bcrypt del `.env`**: Docker Compose interpreta i `$` come
   variabili anche nei valori letti dal `.env`. Con i `$` singoli
   `BASIC_AUTH_USERS` arriva a Traefik troncato (`dipendenti:$2y$05`) e la
   password non funziona mai, senza errori in log. Vanno raddoppiati.
2. **Nessun `TZ` sul container**: il codice formatta le date con
   `timeZone: Europe/Rome` esplicito partendo da un container in UTC. Impostare
   `TZ=Europe/Rome` sposterebbe le date costruite lato server (`new Date(y,m,d)`
   salvate come stringa ISO tornerebbero indietro di un giorno).
3. **fail2ban**: qualche tentativo SSH fallito basta a farsi bannare, e il
   sintomo è una connessione TCP che si apre e viene subito resettata (non un
   "permission denied"). Si sblocca dalla console web del provider con
   `fail2ban-client unban --all`.
4. **`ufw` non protegge le porte pubblicate da Docker**: Docker inserisce le
   proprie regole iptables prima di quelle di ufw. Per chiudere una porta
   pubblicata da un container bisogna togliere la pubblicazione dal compose.
5. **Dati personali su hosting esterno**: rubrica, presenze/assenze e
   segnalazioni sono dati dei dipendenti. Per un ente pubblico servono data
   center UE e un accordo di responsabile del trattamento (art. 28 GDPR) con il
   provider, da verificare prima di andare in produzione.

## 7. Deploy successivi

Stesse esclusioni di `2-ripristina-su-vm.sh`: i file di dati personali nella
cartella di lavoro (Excel dei dipendenti, documenti, dump) non devono finire
sulla VPS.

```bash
rsync -avz --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude='deploy/vps/.env' \
  --exclude='*.xlsx' --exclude='*.xls' --exclude='*.csv' --exclude='*.doc' \
  --exclude='*.sql' --exclude='*.dump' --exclude='~$*' --exclude='/Documenti' \
  ./ root@IP_DELLA_VPS:/opt/intranet/
ssh root@IP_DELLA_VPS 'cd /opt/intranet && docker compose -f deploy/vps/docker-compose.yml up -d --build'
```
