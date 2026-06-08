#!/usr/bin/env bash
#
# Robust ingest launcher.
#
# Why this exists: this machine's default `node` is Homebrew's v25, on which
# `tsx` and Prisma's ESM entry both HANG (Node 25 is a non-LTS/odd release with
# a broken ESM loader here). Node 22 LTS (installed via nvm) works fine. The
# user's interactive zsh already picks up nvm's 22, but non-interactive shells
# (e.g. the ones an agent spawns) fall back to Homebrew 25 and hang.
#
# This wrapper guarantees, from ANY shell:
#   1. nvm is sourced and Node 22 is active
#   2. .env is loaded (tsx/pnpm do not auto-load it -> DIRECT_URL would be unset)
#   3. ingest runs via tsx
#
# Usage:
#   ./scripts/run-ingest.sh payload.json
#   ./scripts/run-ingest.sh --dry-run payload.json
#   pnpm ingest payload.json        (same thing, via package.json script)
#
set -euo pipefail

# repo root = parent of this script's dir
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1. ensure Node 22 via nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "run-ingest: WARNING active node is v$(node -v 2>/dev/null | sed 's/^v//' || echo '?') — expected 22." >&2
  echo "run-ingest: Node 25 hangs on tsx/Prisma here. Run 'nvm install 22 && nvm alias default 22'." >&2
fi

# 2. load .env (KEY=value lines) so DIRECT_URL / SUPABASE_* are present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# 3. run
exec pnpm exec tsx scripts/reconcile-setlists.ts "$@"
