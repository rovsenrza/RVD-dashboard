#!/usr/bin/env bash
# Restores a backup made by scripts/backup.sh (Д29): scripts/restore.sh <db-….dump> [files-….tar.gz]
# Stop the API first. The database is replaced; the 1С cache comes back empty and the next sync
# (or `npm run sync -w @rvd/api`) refills it.
set -euo pipefail
cd "$(dirname "$0")/.."

dump=${1:?Укажите файл базы: scripts/restore.sh backups/db-….dump [backups/files-….tar.gz]}
files=${2:-}
FILES_DIR=${FILES_DIR:-apps/api/data/files}
DB_USER=${DB_USER:-rvd}
DB_NAME=${DB_NAME:-rvd}
PG_RESTORE=${PG_RESTORE:-docker compose exec -T db pg_restore}

$PG_RESTORE -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --single-transaction <"$dump"

# Into a folder on this host, or — with RESTORE_FILES_CMD — e.g. the API's volume in production:
# RESTORE_FILES_CMD="docker compose -f deploy/docker-compose.prod.yml exec -T api tar -xzf - -C /data/files"
if [ -n "$files" ]; then
  if [ -n "${RESTORE_FILES_CMD:-}" ]; then
    $RESTORE_FILES_CMD <"$files"
  else
    mkdir -p "$FILES_DIR"
    tar -xzf "$files" -C "$FILES_DIR"
  fi
fi

echo "Восстановлено из $dump${files:+ и $files}. Теперь заполните кэш 1С: npm run sync -w @rvd/api"
