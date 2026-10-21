#!/usr/bin/env bash
# Architecture guard: feature/app code must compose shared/ui primitives,
# never raw form/table markup. Fails CI when a violation appears.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
if hits=$(grep -rnE '<(button|input|select|textarea|table)\b' apps/web/src/features apps/web/src/app apps/web/src/entities 2>/dev/null); then
  echo "✗ Raw markup outside shared/ui — use Button/Input/DataTable:"
  echo "$hits"
  fail=1
fi
if hits=$(grep -rnE "from '@/features/" apps/web/src/shared apps/web/src/entities 2>/dev/null); then
  echo "✗ Upward import (shared/entities → features):"
  echo "$hits"
  fail=1
fi
if hits=$(grep -rnE "from '@/app/" apps/web/src/shared apps/web/src/entities apps/web/src/features 2>/dev/null | grep -v "@/app/session"); then
  echo "✗ Upward import into app/ (only @/app/session is allowed):"
  echo "$hits"
  fail=1
fi
if hits=$(grep -rnE 'text-\[[0-9.]+(px|rem)\]|(bg|text|border|ring|fill|stroke)-\[#|(bg|text|border|ring)-(black|white)\b' apps/web/src 2>/dev/null); then
  echo "✗ Hard-coded size or colour — use the type scale and role tokens in apps/web/src/index.css:"
  echo "$hits"
  fail=1
fi
[ $fail -eq 0 ] && echo "✓ architecture ok"
exit $fail
