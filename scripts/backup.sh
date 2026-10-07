#!/usr/bin/env bash
# Backup of what only the cabinet holds (Д29): companies and users, requests and their queue,
# settings, the action log, notes, places, messages, files. The 1С cache keeps its shape but not
# its rows — the sync rebuilds it from 1С in seconds. Run nightly (cron) on the server:
#   0 2 * * * cd /opt/rvd && scripts/backup.sh >> backups/backup.log 2>&1
# pg_dump runs inside the compose `db` service unless PG_DUMP says otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-backups}
KEEP=${BACKUP_KEEP:-14}
FILES_DIR=${FILES_DIR:-apps/api/data/files}
DB_USER=${DB_USER:-rvd}
DB_NAME=${DB_NAME:-rvd}
PG_DUMP=${PG_DUMP:-docker compose exec -T db pg_dump}

stamp=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"

# Written under a temporary name first, so a failed dump never passes for a backup.
$PG_DUMP -U "$DB_USER" -d "$DB_NAME" -Fc \
  --exclude-table-data=products \
  --exclude-table-data=product_history \
  --exclude-table-data=equipment \
  --exclude-table-data=sync_state \
  >"$BACKUP_DIR/db-$stamp.dump.part"
mv "$BACKUP_DIR/db-$stamp.dump.part" "$BACKUP_DIR/db-$stamp.dump"

# Files from a folder on this host, or — with FILES_CMD — from wherever they live, e.g. the API's
# volume in production: FILES_CMD="docker compose -f deploy/docker-compose.prod.yml exec -T api tar -czf - -C /data/files ."
if [ -n "${FILES_CMD:-}" ]; then
  $FILES_CMD >"$BACKUP_DIR/files-$stamp.tar.gz.part"
  mv "$BACKUP_DIR/files-$stamp.tar.gz.part" "$BACKUP_DIR/files-$stamp.tar.gz"
elif [ -d "$FILES_DIR" ]; then
  tar -czf "$BACKUP_DIR/files-$stamp.tar.gz.part" -C "$FILES_DIR" .
  mv "$BACKUP_DIR/files-$stamp.tar.gz.part" "$BACKUP_DIR/files-$stamp.tar.gz"
fi

# The newest $KEEP of each kind stay.
for kind in db files; do
  { ls -1t "$BACKUP_DIR"/$kind-* 2>/dev/null || true; } | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f -- "$old"
  done
done

files_note="без файлов ($FILES_DIR нет)"
[ -f "$BACKUP_DIR/files-$stamp.tar.gz" ] && files_note="$BACKUP_DIR/files-$stamp.tar.gz"
echo "$(date '+%F %T') бэкап: $BACKUP_DIR/db-$stamp.dump ($(du -h "$BACKUP_DIR/db-$stamp.dump" | cut -f1)), $files_note"
