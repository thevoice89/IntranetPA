#!/usr/bin/env bash
# Scarica in locale i dati di produzione dal server attuale:
# dump del database + archivio dei file caricati (allegati, PDF, immagini).
#
# Uso:   bash deploy/vps/1-backup-dati.sh [cartella_destinazione]
# Env:   SRC=utente@IP_DEL_SERVER   (server di origine, obbligatorio)
set -euo pipefail

SRC="${SRC:?impostare SRC=utente@IP_DEL_SERVER}"
OUT="${1:-./backup-intranet-$(date +%Y%m%d-%H%M)}"
mkdir -p "$OUT"

echo "==> [1/2] Dump del database da $SRC ..."
ssh "$SRC" 'docker exec intranet-db pg_dump -U intranet -d intranet' > "$OUT/intranet-db.sql"
echo "    $(wc -c < "$OUT/intranet-db.sql") byte"

echo "==> [2/2] Archivio del volume uploads da $SRC ..."
ssh "$SRC" 'docker run --rm -v intranet_uploads:/u -w /u alpine tar czf - .' > "$OUT/uploads.tar.gz"
echo "    $(wc -c < "$OUT/uploads.tar.gz") byte"

# Un dump troncato (connessione caduta) si riconosce dalla riga finale mancante.
if ! tail -5 "$OUT/intranet-db.sql" | grep -q "PostgreSQL database dump complete"; then
  echo "ATTENZIONE: il dump sembra incompleto, ripetere il backup." >&2
  exit 1
fi

echo ""
echo "Backup completo in: $OUT"
