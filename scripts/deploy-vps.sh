#!/usr/bin/env bash
# Ships the cabinet to its server (the API, Postgres, ClamAV and nginx with the web app,
# deploy/docker-compose.prod.yml) and rebuilds what changed.
#   scripts/deploy-vps.sh           — the committed HEAD; uncommitted changes never ship
#   scripts/deploy-vps.sh --init    — first time: also writes the server's .env (once)
# Access comes from .env (never committed): VPS_HOST, VPS_USER and the key ~/.ssh/rvd_vps
# (VPS_KEY to override). The server keeps its own .env in /opt/rvd/app, beside the code;
# the database password and the token secret are generated there and never leave it.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${VPS_HOST:?Задайте VPS_HOST в .env}"
VPS_USER=${VPS_USER:-root}
KEY=${VPS_KEY:-$HOME/.ssh/rvd_vps}
APP=/opt/rvd/app
ssh_vps() { ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$VPS_USER@$VPS_HOST" "$@"; }

if [ "${1:-}" = "--init" ]; then
  : "${ODATA_URL:?Нужны ODATA_URL, ODATA_USER, ODATA_PASSWORD в .env}"
  # The 1С access goes over stdin, not the command line; the rest is generated on the server.
  printf "ODATA_URL='%s'\nODATA_USER='%s'\nODATA_PASSWORD='%s'\n" \
    "$ODATA_URL" "$ODATA_USER" "$ODATA_PASSWORD" |
    ssh_vps "set -e; mkdir -p $APP; cd $APP
      if [ -f .env ]; then echo '.env на сервере уже есть — не трогаю'; cat >/dev/null; exit 0; fi
      umask 077
      { echo \"DB_PASSWORD=\$(openssl rand -hex 24)\"
        echo \"JWT_SECRET=\$(openssl rand -base64 48 | tr -d '\n')\"
        cat
        echo \"CABINET_URL=${CABINET_URL_VPS:-http://$VPS_HOST}\"
        echo 'COOKIE_SECURE=${COOKIE_SECURE_VPS:-false}'
        echo 'LOG_LEVEL=info'
      } > .env
      echo '.env на сервере записан'"
fi

# Exactly the committed tree: unpacked beside the running copy, then swapped in, the server's
# .env and backups kept.
git archive --format=tar HEAD |
  ssh_vps "set -e; rm -rf $APP.new; mkdir -p $APP.new $APP; tar -x -C $APP.new
    rsync -a --delete --exclude /.env --exclude /backups/ $APP.new/ $APP/; rm -rf $APP.new"

ssh_vps "set -e; cd $APP
  docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build --remove-orphans
  docker image prune -f >/dev/null
  docker compose -f deploy/docker-compose.prod.yml ps --format 'table {{.Service}}\t{{.Status}}'"
echo "Опубликовано: $(git rev-parse --short HEAD) → ${CABINET_URL_VPS:-http://$VPS_HOST}"
