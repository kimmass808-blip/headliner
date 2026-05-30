"""
Parse festivallife.kr festivals.json -> structured candidates.

Strategy:
- og_description is hand-written text with a near-consistent template:
  "(공연 )?일정: <date range>  (공연 )?장소: <venue> ..."
- We extract date_range + venue_text. Lineup names live in detail body which
  we don't reliably parse here -- leave for LLM/manual step.
- title often encodes festival name + year + iteration ("... 2026 - 2차 라인업")
- Multiple posts often refer to same festival across the year (1차/2차/최종)
  => group by base name (strip suffix after dash).

Outputs:
  candidates.json: {
    festivals: [{baseName, year, latestPost: {idx, title, ...}, posts: [...], parsedDate, parsedVenue}],
    unparsed: [...],
  }
"""

from __future__ import annotations
import json
import re
import datetime
from pathlib import Path
from collections import defaultdict

DUMP = Path(__file__).resolve().parents[1] / 'dumps' / 'festivallife'
SRC = DUMP / 'festivals.json'
OUT = DUMP / 'candidates.json'


def strip_html_entities(s: str) -> str:
    if not s:
        return ''
    out = s
    for _ in range(3):
        before = out
        out = (out.replace('&nbsp;', ' ')
                  .replace('&#039;', "'").replace('&#39;', "'")
                  .replace('&quot;', '"')
                  .replace('&lt;', '<').replace('&gt;', '>')
                  .replace('&amp;', '&')
                  .replace('&lsquo;', "'").replace('&rsquo;', "'")
                  .replace('﻿', ''))
        if out == before:
            break
    return out


# ----- date parsing -----

# Patterns observed:
#   "2026년 8월 14~16일 (금~일)"
#   "2026년 7월 31~8월 2일 (금~일)"
#   "2026년 6월 6일 (토)"
#   "2026.07.31 - 08.02"
#   "2026.7.31 ~ 2026.8.2"

YEAR_MO_RANGE = re.compile(
    r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})\s*~\s*(\d{1,2})월\s*(\d{1,2})일'
)  # cross-month range
SAME_MO_RANGE = re.compile(
    r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})\s*~\s*(\d{1,2})일'
)
SINGLE_DAY = re.compile(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일')
DOTTED_RANGE = re.compile(
    r'(\d{4})\.(\d{1,2})\.(\d{1,2})\s*[-~]\s*(?:(\d{4})\.)?(\d{1,2})\.(\d{1,2})'
)


def parse_date(text: str) -> dict | None:
    text = strip_html_entities(text)
    # 1. cross-month
    m = YEAR_MO_RANGE.search(text)
    if m:
        y, m1, d1, m2, d2 = (int(x) for x in m.groups())
        return {'start': iso(y, m1, d1), 'end': iso(y, m2, d2)}
    m = SAME_MO_RANGE.search(text)
    if m:
        y, mo, d1, d2 = (int(x) for x in m.groups())
        return {'start': iso(y, mo, d1), 'end': iso(y, mo, d2)}
    m = DOTTED_RANGE.search(text)
    if m:
        y1, mo1, d1, y2, mo2, d2 = m.groups()
        y2 = y2 or y1
        return {'start': iso(int(y1), int(mo1), int(d1)), 'end': iso(int(y2), int(mo2), int(d2))}
    m = SINGLE_DAY.search(text)
    if m:
        y, mo, d = (int(x) for x in m.groups())
        return {'start': iso(y, mo, d), 'end': iso(y, mo, d)}
    return None


def iso(y: int, m: int, d: int) -> str:
    try:
        return datetime.date(y, m, d).isoformat()
    except ValueError:
        return f'{y:04d}-{m:02d}-{d:02d}'  # tolerate edge cases


# ----- venue parsing -----

VENUE_PAT = re.compile(r'(?:공연\s*)?장소\s*[:：]\s*([^\n가-힣]?[^\n]+?)(?=\s*(?:티켓|예매|가격|오픈|일정|공연|✈|📍|$))')
# fallback simpler
VENUE_SIMPLE = re.compile(r'(?:공연\s*)?장소\s*[:：]\s*([^\n]+?)(?:\s{2,}|$)')


def parse_venue(text: str) -> str | None:
    text = strip_html_entities(text)
    # find 장소: marker and capture up to a sentinel
    idx = text.find('장소')
    if idx < 0:
        return None
    after = text[idx:]
    after = re.sub(r'^(?:공연\s*)?장소\s*[:：]\s*', '', after)
    # cut at next section keyword
    cutpoints = []
    for kw in ['가격', '티켓', '예매', '오픈', '일정', '공연 일정', '✈', '📍', '\n', '  ']:
        i = after.find(kw)
        if i > 0:
            cutpoints.append(i)
    if cutpoints:
        after = after[:min(cutpoints)]
    venue = after.strip().strip(',').strip()
    # drop empty / too long
    if not venue or len(venue) > 80:
        return None
    return venue


# ----- title / base-name normalization -----

YEAR_IN_TITLE = re.compile(r'\b(20\d{2})\b')
# Aggressive: festivallife titles consistently use "{name} - {iteration}".
# Strip everything from the first dash onward (after a year, if any).
ITERATION_SUFFIX = re.compile(r'\s*[-–—]\s*.*$')

# Trailing iteration tokens that appear without a dash (e.g., "... 2022 개최 확정").
# Apply after ITERATION_SUFFIX.
TRAILING_NO_DASH = re.compile(
    r'\s+(?:'
    r'개최\s*확정|개최\s*일정?\s*발표|개최일\s*발표|개최\s*취소|취소|연기|'
    r'라인업(?:\s*발표|\s*공개)?|타임테이블|일정\s*공개|장소\s*공개|'
    r'헤드라이너\s*공개|티켓\s*오픈|굿즈|기념품|후기|리뷰|영상|티저|'
    r'\d+차(?:\s*라인업)?|최종(?:\s*라인업)?|얼리버드'
    r')\s*$'
)

# Invisible characters that break equality: BOM, zero-width spaces, etc.
INVISIBLE = re.compile(r'[​-‏‪-‮⁠﻿]')


def base_name(title: str) -> tuple[str, int | None]:
    # Strip invisible/zero-width chars (BOMs, etc.) that break equality.
    t = INVISIBLE.sub('', title).strip()
    year = None
    m = YEAR_IN_TITLE.search(t)
    if m:
        year = int(m.group(1))
    # strip "- 1차 라인업" type suffix
    t2 = ITERATION_SUFFIX.sub('', t).strip()
    # strip trailing iteration tokens that lack a dash (e.g., "... 2022 개최 확정")
    # apply repeatedly until stable, in case multiple tokens are present
    for _ in range(3):
        new = TRAILING_NO_DASH.sub('', t2).strip()
        if new == t2:
            break
        t2 = new
    # strip year off the name for grouping key
    name_no_year = YEAR_IN_TITLE.sub('', t2).strip()
    # collapse stray punctuation
    name_no_year = re.sub(r'[-–—]\s*$', '', name_no_year).strip()
    name_no_year = re.sub(r'\s+', ' ', name_no_year)
    return name_no_year, year


def group_key(name: str, year: int | None) -> tuple[str, int | None]:
    # collapse all whitespace + lowercase Latin for matching purposes
    key = re.sub(r'\s+', '', name).lower()
    return key, year


def main():
    with open(SRC, encoding='utf-8') as f:
        src = json.load(f)

    parsed = []
    unparsed = []
    for it in src['items']:
        desc = strip_html_entities(it.get('og_description') or '')
        title = it.get('title') or ''
        date = parse_date(desc) or parse_date(title)
        venue = parse_venue(desc)
        bn, yr = base_name(title)
        rec = {
            'idx': it['idx'],
            'title': title,
            'href': it['href'],
            'thumbnail': it.get('thumbnail'),
            'og_image': it.get('og_image'),
            'description': desc,
            'baseName': bn,
            'year': yr,
            'parsedDate': date,
            'parsedVenue': venue,
        }
        # Include in the grouping pass as long as we have a year (group key).
        # Posts with no year and no date/venue are dropped to unparsed for review.
        if yr is not None or date or venue:
            parsed.append(rec)
        else:
            unparsed.append(rec)

    # Group by normalized (whitespace-collapsed) name + year
    groups = defaultdict(list)
    for r in parsed:
        groups[group_key(r['baseName'], r['year'])].append(r)
    festivals = []
    for key, posts in groups.items():
        posts.sort(key=lambda x: int(x['idx']), reverse=True)  # newest post first
        latest = posts[0]
        # prefer the longest baseName variant for display (usually most informative)
        bn = max((p['baseName'] for p in posts), key=len)
        yr = latest['year']
        # take best date/venue from any post in group (newest preferred)
        date = next((p['parsedDate'] for p in posts if p['parsedDate']), None)
        venue = next((p['parsedVenue'] for p in posts if p['parsedVenue']), None)
        festivals.append({
            'baseName': bn,
            'year': yr,
            'parsedDate': date,
            'parsedVenue': venue,
            'latestIdx': latest['idx'],
            'latestTitle': latest['title'],
            'latestHref': latest['href'],
            'thumbnail': latest['thumbnail'],
            'og_image': latest['og_image'],
            'description': latest['description'],
            'postCount': len(posts),
            'allPostIdxs': [p['idx'] for p in posts],
        })

    festivals.sort(key=lambda x: (x['year'] or 0, x['baseName']), reverse=True)

    out = {
        'source': 'festivallife.kr (analyzed)',
        'generatedAt': datetime.datetime.now(datetime.UTC).isoformat(),
        'sourceCount': len(src['items']),
        'parsedCount': len(parsed),
        'unparsedCount': len(unparsed),
        'groupedFestivalCount': len(festivals),
        'festivals': festivals,
        'unparsed': unparsed,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"posts: {len(src['items'])}  parsed: {len(parsed)}  unparsed: {len(unparsed)}")
    print(f"unique festivals (baseName+year): {len(festivals)}")
    # print 10 samples
    for fest in festivals[:10]:
        d = fest['parsedDate']
        dr = f"{d['start']} – {d['end']}" if d else '(no date)'
        v = fest['parsedVenue'] or '(no venue)'
        print(f"  {fest['year']} {fest['baseName']:<40} | {dr:<25} | {v}")


if __name__ == '__main__':
    main()
