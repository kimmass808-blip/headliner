#!/usr/bin/env bash
# Polite fetcher for festivallife.kr categories (festival|concert|...).
#
# Improvements over prior 1-shot script:
# - serial (1 at a time) + 0.5s sleep => avoids 429
# - real last-page detection: stop when first idx of page N == first idx of N-1
# - resumable: skip files already present and non-empty
# - same-pattern detail fetch
#
# Usage:
#   ./crawler/fetch-festivallife.sh concert
#   ./crawler/fetch-festivallife.sh festival

set -e
CATEGORY="${1:?usage: $0 <category>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="$ROOT/crawler/dumps/festivallife-$CATEGORY"
LIST="$DUMP/list"
DETAIL="$DUMP/detail"
mkdir -p "$LIST" "$DETAIL"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
SLEEP="${SLEEP:-0.5}"

fetch() {
  # $1=url $2=out_path. Skip if file exists and non-empty.
  local url="$1" out="$2"
  if [ -s "$out" ]; then return 0; fi
  curl -sL --max-time 30 -A "$UA" "$url" -o "$out"
  sleep "$SLEEP"
}

# --- step 1: list pages with real-end detection ---
echo "[fetch] list pages for /$CATEGORY"
prev_first=""
for p in $(seq 1 100); do
  out="$LIST/page-$p.html"
  fetch "https://festivallife.kr/$CATEGORY/?page=$p" "$out"
  # extract first idx from this page
  first=$(grep -oE 'bmode=view&idx=[0-9]+' "$out" | head -1 | sed 's/bmode=view&idx=//')
  if [ -z "$first" ]; then
    echo "  p$p: no items, stopping"
    rm -f "$out"
    break
  fi
  if [ "$first" = "$prev_first" ]; then
    echo "  p$p: same first_idx as p$((p-1)) ($first), real end reached"
    rm -f "$out"
    break
  fi
  echo "  p$p: first_idx=$first"
  prev_first="$first"
done

# --- step 2: collect idxs across all pages ---
echo "[parse] collecting idxs"
grep -hoE 'bmode=view&idx=[0-9]+' "$LIST"/*.html \
  | sed 's/bmode=view&idx=//' \
  | sort -u > "$DUMP/idxs.txt"
echo "  unique idxs: $(wc -l < "$DUMP/idxs.txt")"

# --- step 3: detail pages (serial, polite) ---
echo "[fetch] detail pages"
total=$(wc -l < "$DUMP/idxs.txt")
i=0
while read -r idx; do
  i=$((i+1))
  fetch "https://festivallife.kr/$CATEGORY/?bmode=view&idx=$idx" "$DETAIL/$idx.html"
  if [ $((i % 50)) -eq 0 ]; then
    echo "  $i/$total ..."
  fi
done < "$DUMP/idxs.txt"

echo "[done] $CATEGORY: $(ls "$DETAIL" | wc -l) detail pages saved"
