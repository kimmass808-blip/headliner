#!/usr/bin/env bash
#
# extract-setlist-youtube 런처.
# run-reconcile-setlists.sh 와 동일한 이유로 존재한다:
#   - 이 머신 기본 node(Homebrew 25)는 tsx/Prisma ESM에서 HANG → nvm Node 22 강제
#   - .env 로드(DIRECT_URL 등) 후 tsx 실행
#
# 사용:
#   ./scripts/run-extract-setlist-youtube.sh --url <link> --artist <igHandle> [--dry-run]
#   pnpm extract-setlist-yt --url <link> --artist <igHandle>
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" != "22" ]; then
  echo "run-extract: WARNING active node is v$(node -v 2>/dev/null | sed 's/^v//' || echo '?') — expected 22 (Node 25 hangs on tsx/Prisma here)." >&2
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

exec pnpm exec tsx scripts/extract-setlist-youtube.ts "$@"
