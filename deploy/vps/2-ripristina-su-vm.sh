#!/usr/bin/env bash
# Copia il progetto sulla VPS, ripristina database e file caricati,
# poi avvia lo stack. Idempotente: si può rilanciare per un nuovo allineamento
# dei dati prima del passaggio definitivo.
#
# Uso:   bash deploy/vps/2-ripristina-su-vm.sh <cartella_backup>
# Env:   VM=root@IP_DELLA_VM     REMOTE_DIR=/opt/intranet
#
# PREREQUISITO: sulla VM deve esistere già $REMOTE_DIR/deploy/vps/.env
# (viene copiato da questo script solo se presente in locale in
#  deploy/vps/.env; altrimenti crealo a mano prima del primo avvio).
set -euo pipefail

BACKUP="${1:?indicare la cartella di backup creata da 1-backup-dati.sh}"
VM="${VM:?impostare VM=root@IP_DELLA_VM}"
REMOTE_DIR="${REMOTE_DIR:-/opt/intranet}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

[ -f "$BACKUP/intranet-db.sql" ] || { echo "manca $BACKUP/intranet-db.sql" >&2; exit 1; }
[ -f "$BACKUP/uploads.tar.gz" ] || { echo "manca $BACKUP/uploads.tar.gz" >&2; exit 1; }

echo "==> [1/5] Sincronizzazione del progetto su $VM:$REMOTE_DIR ..."
# Esclusi anche i file di dati personali che stanno nella cartella di lavoro
# (elenchi dipendenti in Excel, documenti, dump): non servono alla build e non
# devono finire su una VM pubblica. Stessi pattern di .gitignore/.dockerignore.
rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='openmsp' --exclude='backup-intranet-*' \
  --exclude='deploy/vps/.env' \
  --exclude='*.xlsx' --exclude='*.xls' --exclude='*.csv' --exclude='*.doc' \
  --exclude='*.sql' --exclude='*.dump' --exclude='~$*' --exclude='/Documenti' \
  "$ROOT/" "$VM:$REMOTE_DIR/"

if [ -f "$ROOT/deploy/vps/.env" ]; then
  echo "    copia del .env locale ..."
  scp "$ROOT/deploy/vps/.env" "$VM:$REMOTE_DIR/deploy/vps/.env"
fi

echo "==> [2/5] Avvio del solo database ..."
ssh "$VM" "cd $REMOTE_DIR && docker compose -f deploy/vps/docker-compose.yml up -d db && \
  for i in \$(seq 1 30); do docker exec intranet-db pg_isready -q && break; sleep 2; done"

echo "==> [3/5] Ripristino del database ..."
# Il controllo delle foreign key va disattivato durante il caricamento:
# altrimenti il primo errore manda la transazione psql in stato "aborted" e
# TUTTE le righe successive del dump vengono saltate in silenzio.
(echo "SET session_replication_role = replica;"; cat "$BACKUP/intranet-db.sql") \
  | ssh "$VM" "docker exec -i intranet-db psql -v ON_ERROR_STOP=0 -U intranet -d intranet" \
  | tail -20

echo "==> [4/5] Ripristino dei file caricati ..."
ssh "$VM" "docker run --rm -i -v intranet_uploads:/u -w /u alpine sh -c 'rm -rf ./* && tar xzf -'" \
  < "$BACKUP/uploads.tar.gz"

echo "==> [5/5] Build e avvio dello stack completo ..."
ssh "$VM" "cd $REMOTE_DIR && docker compose -f deploy/vps/docker-compose.yml up -d --build"

echo ""
echo "Fatto. Verifiche rapide:"
echo "  ssh $VM 'docker ps --filter name=intranet'"
echo "  ssh $VM 'docker logs --tail 40 intranet-traefik'   # emissione certificato"
