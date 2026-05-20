"""
Build candidates.json from metas.tsv (produced by festivallife-concert.sh).

We skip the slow per-file Python reads entirely; shell extracts the 3 meta
fields per file into a small TSV that this script processes in one pass.
"""

from __future__ import annotations
import re
import json
import datetime
from pathlib import Path

DUMP = Path(__file__).resolve().parents[1] / 'dumps' / 'festivallife-concert'
SRC = DUMP / 'metas.tsv'
OUT = DUMP / 'candidates.json'

TITLE_SUFFIX = re.compile(r'\s*:\s*국내공연\s*정보\s*$')
DATE_PAT = re.compile(r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일')
TIME_PAT = re.compile(r'(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?')


def clean_title(t: str) -> str:
    return ' '.join(TITLE_SUFFIX.sub('', t).split())


def parse_date_time(desc: str) -> tuple[str | None, str | None]:
    date_iso = None
    md = DATE_PAT.search(desc)
    if md:
        y, mo, d = (int(x) for x in md.groups())
        try:
            date_iso = datetime.date(y, mo, d).isoformat()
        except ValueError:
            pass
    time_str = None
    mt = TIME_PAT.search(desc)
    if mt:
        period, hour, minute = mt.group(1), int(mt.group(2)), int(mt.group(3) or 0)
        if period == '오후' and hour < 12:
            hour += 12
        if period == '오전' and hour == 12:
            hour = 0
        time_str = f'{hour:02d}:{minute:02d}'
    return date_iso, time_str


def parse_venue(desc: str) -> str | None:
    idx = desc.find('공연 장소')
    if idx < 0:
        return None
    after = re.sub(r'^공연\s*장소\s*[:：]\s*', '', desc[idx:])
    cuts = [after.find(k) for k in ['예매', '티켓', '가격', '\n']]
    cuts = [c for c in cuts if c > 0]
    if cuts:
        after = after[: min(cuts)]
    v = after.strip().rstrip(',').strip()
    return v or None


def main():
    items = []
    with open(SRC, encoding='utf-8') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) < 4:
                continue
            idx, raw_title, desc, image = parts[0], parts[1], parts[2], parts[3]
            title = clean_title(raw_title)
            date_iso, time_str = parse_date_time(desc)
            venue = parse_venue(desc)
            items.append({
                'idx': idx,
                'title': title,
                'rawTitle': raw_title,
                'date': date_iso,
                'startTime': time_str,
                'venueText': venue,
                'image': image or None,
                'sourceUrl': f'https://festivallife.kr/concert/?bmode=view&idx={idx}',
                'rawDescription': desc,
            })

    parsed = [x for x in items if x['date'] or x['venueText']]
    out = {
        'source': 'festivallife.kr/concert',
        'generatedAt': datetime.datetime.now(datetime.UTC).isoformat(),
        'totalFiles': len(items),
        'parsedCount': len(parsed),
        'noDataCount': len(items) - len(parsed),
        'items': items,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'total: {len(items)}  parsed: {len(parsed)}  no_data: {len(items) - len(parsed)}')
    for it in parsed[:5]:
        print(f"  [{it['idx']}] {it['title']}")
        print(f"    {it['date']} {it['startTime'] or ''} @ {it['venueText'] or '(no venue)'}")


if __name__ == '__main__':
    main()
