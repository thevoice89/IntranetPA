#!/usr/bin/env bash
# Installa sulla VM un backup notturno (DB + uploads) con rotazione a 14 giorni.
# Sul server attuale il backup era implicito nella rete interna: su una VM
# pubblica è l'unica rete di sicurezza contro cancellazioni ed errori.
#
# Uso:  bash deploy/vps/3-backup-automatico.sh
# Env:  VM=root@IP_DELLA_VM
set -euo pipefail
VM="${VM:?impostare VM=root@IP_DELLA_VM}"

ssh "$VM" 'bash -s' <<'REMOTE'
set -euo pipefail
mkdir -p /opt/backup-intranet
cat > /usr/local/bin/backup-intranet.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
DEST=/opt/backup-intranet
STAMP=$(date +%Y%m%d)
docker exec intranet-db pg_dump -U intranet -d intranet | gzip > "$DEST/db-$STAMP.sql.gz"
docker run --rm -v intranet_uploads:/u -w /u alpine tar czf - . > "$DEST/uploads-$STAMP.tar.gz"
find "$DEST" -name '*.gz' -mtime +14 -delete
SCRIPT
chmod +x /usr/local/bin/backup-intranet.sh
( crontab -l 2>/dev/null | grep -v backup-intranet.sh; \
  echo "15 2 * * * /usr/local/bin/backup-intranet.sh >> /var/log/backup-intranet.log 2>&1" ) | crontab -
echo "cron installato:"; crontab -l | grep backup-intranet
REMOTE
