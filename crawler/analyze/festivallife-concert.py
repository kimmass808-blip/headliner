"""
Parse festivallife.kr /concert detail pages -> Show candidates.
Mirrors festivallife.py's pattern exactly so we have one approach for both
categories.
"""

from __future__ import annotations
import re
import json
import datetime
from pathlib import Path

DUMP = Path(__file__).resolve().parents[1] / 'dumps' / 'festivallife-concert'
DETAIL = DUMP / 'detail'
OUT = DUMP / 'candidates.json'


# Same meta() helper used by festivallife.py
def meta(html: str, prop: str) -> str | None:
    for m in re.finditer(r'<meta\s+([^>]+)>', html):
        attrs = m.group(1)
        p = re.search(r'(?:property|name)="([^"]+)"', attrs)
        c = re.search(r'content="([^"]*)"', attrs)
        if p and c and p.group(1) == prop:
            return c.group(1)
    return None


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
    import sys
    items = []
    files = sorted(DETAIL.glob('*.html'))
    print(f'parsing {len(files)} files...', flush=True)
    for i, p in enumerate(files):
        with open(p, encoding='utf-8', errors='replace') as f:
            html = f.read()
        idx = p.stem
        raw_title = meta(html, 'og:title') or ''
        title = clean_title(raw_title)
        desc = meta(html, 'og:description') or meta(html, 'description') or ''
        img = meta(html, 'og:image')
        date_iso, time_str = parse_date_time(desc)
        venue = parse_venue(desc)
        items.append({
            'idx': idx,
            'title': title,
            'rawTitle': raw_title,
            'date': date_iso,
            'startTime': time_str,
            'venueText': venue,
            'image': img,
            'sourceUrl': f'https://festivallife.kr/concert/?bmode=view&idx={idx}',
            'rawDescription': desc,
        })
        if (i + 1) % 50 == 0:
            print(f'  {i + 1}/{len(files)}', flush=True)

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
