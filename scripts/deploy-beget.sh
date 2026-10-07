#!/usr/bin/env bash
# Publishes the web app to the customer's hosting (Beget, clientrvd.vgiz.ru) over SFTP.
#   scripts/deploy-beget.sh          — the demo, on mocks (what the Vercel preview was)
#   scripts/deploy-beget.sh live     — against the API at VITE_API_BASE_URL (once the API has a home)
# Access comes from .env (never committed): BEGET_HOST, BEGET_USER, BEGET_PASS, and BEGET_DIR —
# the site's folder on the server, «.» when the login lands in it (it does for this account).
# The folder is mirrored: what the build does not have is removed there, except cgi-bin/.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${BEGET_HOST:?Задайте BEGET_HOST в .env}"
: "${BEGET_USER:?Задайте BEGET_USER в .env}"
: "${BEGET_PASS:?Задайте BEGET_PASS в .env}"
REMOTE=${BEGET_DIR:-.}
MODE=${1:-demo}

case "$MODE" in
  demo)
    export VITE_USE_MOCKS=true VITE_LIVE_API=false VITE_API_BASE_URL=/api
    ;;
  live)
    : "${VITE_API_BASE_URL:?Для live укажите, где API: VITE_API_BASE_URL=https://…}"
    export VITE_USE_MOCKS=false VITE_LIVE_API=true
    ;;
  *)
    echo "Режим — demo или live, не «$MODE»" >&2
    exit 2
    ;;
esac

npm run build
if [ "$MODE" = live ]; then
  # Without mocks the service worker has nothing to do; it should not sit on the site either.
  rm -f dist/mockServiceWorker.js
  # An API on its own origin must be let through the page's CSP: calls and file links.
  case "$VITE_API_BASE_URL" in
    http://* | https://*)
      origin=$(printf '%s' "$VITE_API_BASE_URL" | sed -E 's#^(https?://[^/]+).*#\1#')
      sed -i.bak -e "s#connect-src 'self'#connect-src 'self' $origin#" \
        -e "s#img-src 'self'#img-src 'self' $origin#" dist/.htaccess
      rm -f dist/.htaccess.bak
      ;;
  esac
fi

lftp -u "$BEGET_USER,$BEGET_PASS" "sftp://$BEGET_HOST" -e "
  set sftp:auto-confirm yes
  set net:max-retries 2
  set net:timeout 30
  mirror --reverse --delete --verbose=1 --exclude-glob cgi-bin/ dist/ $REMOTE/
  bye
"
echo "Опубликовано ($MODE): http://${BEGET_SITE:-clientrvd.vgiz.ru}/"
