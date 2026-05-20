#!/usr/bin/env bash
# Single-pass meta extractor using find + xargs to avoid arg-list issues.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DUMP="$ROOT/crawler/dumps/festivallife-concert"
DETAIL="$DUMP/detail"
RAW="$DUMP/metas.raw"
OUT="$DUMP/metas.tsv"

echo "start: $(date)"
echo "detail dir: $DETAIL"
echo "file count: $(ls "$DETAIL" 2>/dev/null | wc -l | tr -d ' ')"
echo

# Use find + xargs to feed all html files to grep without hitting arg limits.
# -H ensures filename is printed even with single-file invocations.
echo "running single-pass grep via xargs..."
find "$DETAIL" -name '*.html' -type f -print0 | \
  xargs -0 grep -H -oE '<meta property="og:(title|description|image)" content="[^"]*"' \
  > "$RAW"

echo "raw lines extracted: $(wc -l < "$RAW" | tr -d ' ')"

# awk: group by filename, emit TSV (idx, title, desc, image).
awk '
function flush() {
  if (cur != "") {
    printf "%s\t%s\t%s\t%s\n", cur, title, desc, image
  }
  title=""; desc=""; image=""
}
{
  pos = index($0, ":<meta")
  if (pos == 0) next
  fn = substr($0, 1, pos-1)
  rest = substr($0, pos+1)
  n = split(fn, a, "/")
  idx = a[n]; sub(/\.html$/, "", idx)
  if (idx != cur) { flush(); cur = idx }
  match(rest, /content="[^"]*"/)
  if (RSTART == 0) next
  val = substr(rest, RSTART+9, RLENGTH-10)
  if (rest ~ /og:title/ && title == "") title = val
  else if (rest ~ /og:description/ && desc == "") desc = val
  else if (rest ~ /og:image/ && image == "") image = val
}
END { flush() }
' "$RAW" > "$OUT"

echo "wrote $(wc -l < "$OUT" | tr -d ' ') TSV lines to $OUT"
echo "done: $(date)"
