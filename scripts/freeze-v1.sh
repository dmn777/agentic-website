#!/usr/bin/env bash
# Rebuild the frozen Cowork-era site (commit f1c14f7) under /agentic-website/v1/ and copy
# it into public/v1/. The only source change is the BASE constant in astro.config.mjs.
# The footer's "last build" date is pinned to the original deploy (2026-09-22, Actions run
# #6) so the snapshot doesn't claim a rebuild date. Reproducible: re-running gives the
# same bytes. Usage: bash scripts/freeze-v1.sh [workdir]
set -euo pipefail
SITE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$(mktemp -d)}/v1-build"
COMMIT=f1c14f7
ORIGINAL_BUILD_DATE=2026-09-22

rm -rf "$WORK"
git -C "$SITE" worktree add --detach "$WORK" "$COMMIT" >/dev/null
trap 'git -C "$SITE" worktree remove --force "$WORK" >/dev/null 2>&1 || true' EXIT
sed -i "s|^const BASE = '/agentic-website';|const BASE = '/agentic-website/v1';|" "$WORK/astro.config.mjs"
grep -q "^const BASE = '/agentic-website/v1';" "$WORK/astro.config.mjs" || { echo "BASE edit failed" >&2; exit 1; }
(cd "$WORK" && npm ci --silent && npx astro build >/dev/null)
find "$WORK/dist" -name '*.html' -exec sed -i "s/last build [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}/last build $ORIGINAL_BUILD_DATE/" {} +
rm -rf "$SITE/public/v1"
cp -r "$WORK/dist" "$SITE/public/v1"
echo "Frozen $COMMIT into public/v1/ ($(find "$SITE/public/v1" -type f | wc -l) files)"
