#!/usr/bin/env bash
#
# review-learn launcher (크롤/ingest 배치 시작 시 1회 실행).
#
# run-ingest.sh 와 같은 이유로 존재: 비대화형 셸에서도 nvm Node 22 + .env 를
# 보장해 tsx/Prisma 가 멈추지 않게 한다.
#
# Usage:
#   ./scripts/run-review-learn.sh
#   ./scripts/run-review-learn.sh --all --dry-run
#   pnpm review:learn
#
set -euo pipefail

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
  echo "run-review-learn: WARNING active node is v$(node -v 2>/dev/null | sed 's/^v//' || echo '?') — expected 22." >&2
fi

# 2. load .env so DIRECT_URL is present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# 3. run
exec pnpm exec tsx scripts/review-learn.ts "$@"
