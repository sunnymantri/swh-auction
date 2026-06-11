#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

# Accept common payload shapes for shell hook events.
command_text="$(printf '%s' "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("command") or d.get("tool_input",{}).get("command") or "")' 2>/dev/null || true)"
exit_code="$(printf '%s' "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("exit_code", d.get("tool_output",{}).get("exit_code", 0)))' 2>/dev/null || echo 0)"

# Only run on successful npm production builds.
if [[ "$command_text" != "npm run build" ]]; then
  exit 0
fi
if [[ "$exit_code" != "0" ]]; then
  exit 0
fi

for bin in git npm npx node python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Hook skipped: missing dependency '$bin'."
    exit 0
  fi
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Hook skipped: not a git repository."
  exit 0
fi

# 1) Bump version.
npm run version:bump
version="$(node -p "require('./package.json').version")"

# 2) Commit + push any resulting changes.
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "chore: release v${version}"
  git push origin HEAD
fi

# 3) Push pending Supabase migrations.
printf 'y\n' | npx supabase db push

# 4) Deploy current state to Netlify production.
npx netlify deploy --prod --dir=dist

echo "Hook completed: GitHub, Supabase, and Netlify synced for v${version}."
