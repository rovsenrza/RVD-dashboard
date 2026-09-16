#!/usr/bin/env bash
# Architecture guard: feature/app code must compose shared/ui primitives,
# never raw form/table markup. Fails CI when a violation appears.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
if hits=$(grep -rnE '<(button|input|select|textarea|table)\b' src/features src/app src/entities 2>/dev/null); then
  echo "✗ Raw markup outside shared/ui — use Button/Input/DataTable:"
  echo "$hits"
  fail=1
fi
if hits=$(grep -rnE "from '@/features/" src/shared src/entities 2>/dev/null); then
  echo "✗ Upward import (shared/entities → features):"
  echo "$hits"
  fail=1
fi
if hits=$(grep -rnE "from '@/app/" src/shared src/entities src/features 2>/dev/null | grep -v "@/app/session"); then
  echo "✗ Upward import into app/ (only @/app/session is allowed):"
  echo "$hits"
  fail=1
fi
[ $fail -eq 0 ] && echo "✓ architecture ok"
exit $fail
