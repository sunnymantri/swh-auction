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

# Bump version only. Migration + deploy are intentional manual steps
# so that DB changes are reviewed and applied before the frontend ships.
# See scripts/release.sh for the full release sequence.
npm run version:bump
version="$(node -p "require('./package.json').version")"

echo "Build hook: version bumped to v${version}. Run scripts/release.sh to deploy."
