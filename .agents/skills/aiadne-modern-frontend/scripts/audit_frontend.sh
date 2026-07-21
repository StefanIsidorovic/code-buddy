#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
cd "$repo_root"

failures=0
fail() { printf 'frontend-audit: %s\n' "$1" >&2; failures=$((failures + 1)); }

app_lines=$(wc -l < src/App.tsx)
if (( app_lines > 2200 )); then
  fail "src/App.tsx has ${app_lines} lines; ceiling is 2200 and new work should reduce it"
fi

while IFS= read -r file; do
  lines=$(wc -l < "$file")
  if (( lines > 250 )); then fail "$file has ${lines} lines; feature module ceiling is 250"; fi
done < <(find src/features src/components -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' | sort)

if rg -n 'from "@tauri-apps/api/core"' src --glob '*.ts' --glob '*.tsx' \
  --glob '!src/App.test.tsx' --glob '!src/lib/tauriGateway.ts' \
  --glob '!src/lib/tauriGateway.test.ts' >/dev/null; then
  fail "direct Tauri core import found outside tauriGateway/tests"
fi

if rg -n 'from "@xterm' src --glob '*.ts' --glob '*.tsx' \
  --glob '!src/App.test.tsx' --glob '!src/features/runtime/usePtyTerminal.ts' \
  --glob '!src/features/runtime/usePtyTerminal.test.tsx' >/dev/null; then
  fail "direct xterm import found outside the terminal hook/tests"
fi

if rg -n '(:[[:space:]]*any\b|as[[:space:]]+any\b|<any>|@ts-ignore)' src \
  --glob '*.ts' --glob '*.tsx' >/dev/null; then
  fail "unsafe TypeScript escape hatch found"
fi

while IFS= read -r source; do
  test_file="${source%.tsx}.test.tsx"
  if [[ ! -f "$test_file" ]]; then fail "$source has no colocated $test_file"; fi
done < <(find src/features -type f -name '*.tsx' ! -name '*.test.tsx' | sort)

if (( failures > 0 )); then
  printf 'frontend-audit: failed with %d issue(s)\n' "$failures" >&2
  exit 1
fi
printf 'frontend-audit: passed (%s App.tsx lines)\n' "$app_lines"
