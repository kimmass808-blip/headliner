/**
 * Extract artist names from concert Show titles and link them.
 *
 * Conservative parser: only acts on clearly-marked patterns.
 *
 * Patterns recognized (in priority order):
 *   1. brackets:  [X 단독 콘서트]  /  ［X 단독 콘서트］  /  「X 단독 콘서트」
 *   2. brackets:  [X 콘서트] / [X 라이브] / [X LIVE]
 *   3. brackets:  〈X〉, 《X》  (treat inside as artist when title structure fits)
 *   4. bare:      X 단독 콘서트
 *   5. bare:      X YYYY TOUR ...
 *
 * Multi-artist split inside extracted token: X (with surrounding spaces),
 * ＆/&, +, feat., with, 콜라보.
 *
 * For each candidate name:
 *   - try canonicalizeArtistName -> key
 *   - look up existing Artist by canonicalKey or by name appearing in aliases
 *   - if not found, create new Artist with empty aliases
 *   - link Show <-> Artist via raw SQL (A=Artist, B=Show, per migration 20260520120000)
 *
 * Updates Show.completeness and Show.needsReview after linking.
 */

import { PrismaClient } from '@prisma/client';
import { canonicalizeArtistName } from '@mft/canonicalize';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

// Open + close bracket char classes. Note Korean/Japanese half/full-width variants.
const OPEN = `[\\[\\(「『〈《｟［（｛【〚｢]`;
const CLOSE = `[\\]\\)」』〉》｠］）｝】〛｣]`;
const INSIDE = `[^${'\\]\\)」』〉》｠］）｝】〛｣'}]`;

// Bracketed patterns: inside parentheses says X is the artist.
const BRACKETS_SOLO = new RegExp(`${OPEN}\\s*(${INSIDE}{1,60})\\s*단독\\s*콘서트\\s*${CLOSE}`);
const BRACKETS_CONCERT = new RegExp(
  `${OPEN}\\s*(${INSIDE}{1,60})\\s+(?:콘서트|라이브|LIVE|쇼)\\s*${CLOSE}`,
  'i',
);
// First token inside any bracket (when the bracket frames a subtitle):
//   "...［SAAY 가을 소극장 콘서트 "CLOUD 9"］"  -> SAAY
// Exclude opening brackets (full-width parens etc.) so we don't capture
// "사비나앤드론즈（Savina" as one token.
const BRACKETS_FIRST_TOKEN = new RegExp(
  `${OPEN}\\s*([^\\s\\[\\(（｢「『〈《｟［｛【〚${'\\]\\)」』〉》｠］）｝】〛｣'}]{1,30})\\s+`,
);
// Plain angle/curly bracket content (no "콘서트" keyword needed) — common for tour names where
// the artist is the only thing inside. e.g.,  "TONE STUDIO LIVE 〈사비나앤드론즈〉".
// We only accept this if the inside is short (<= 30) and contains Korean OR mostly letters.
const BRACKETS_ANGLE = /[〈《｟「『]([^〉》｠」』]{1,30})[〉》｠」』]/;

// Bare patterns:
const BARE_SOLO = /([^\s]{1,30})\s+단독\s*(?:콘서트|공연|쇼)/;
const BARE_TOUR = /^([^\s]{1,30}(?:\s+[^\s]{1,30}){0,2})\s+(?:20\d{2}\s+)?(?:TOUR|투어)/i;
//   "김창완밴드 콘서트 - 의정부"  →  김창완밴드
const BARE_CONCERT_CITY = /^([^\s]{1,30}(?:\s+[^\s]{1,30}){0,2})\s+콘서트\s*[-–—]\s/;
//   "김창완밴드 콘서트"  (after city stripper removed " - 의정부")  →  김창완밴드
const BARE_CONCERT_END = /^([^\s]{1,30}(?:\s+[^\s]{1,30}){0,2})\s+콘서트\s*$/;
//   "김승주 앨범 발매 쇼케이스 ..." or "이오늘 두 번째 미니앨범 발매 기념 공연" — single leading token.
//   Allow up to 4 filler words between the artist and the release keyword.
const BARE_RELEASE = /^([^\s]{1,30})(?:\s+[^\s]{1,30}){0,4}\s+(?:쇼케이스|발매\s*기념|발매\s*기념\s*공연|발매\s*공연)/;
//   "78LIVE - 잭킹콩(JKC)"  /  "TICKET TO X - 백현진"
const DASH_THEN_NAME = /\s[-–—]\s*([^\s\[\(（]{1,30})/;
//   "X：Y"  or  "X：Y"  (Korean colon)  — Y is the artist (X is a brand prefix)
const AFTER_COLON = /[：:]\s*([^：:\[\(（]{1,30})\s*$/;
//   "X 'Subtitle'" or "X "Subtitle""  →  X  (incl. ASCII ' and " quotes)
const BEFORE_QUOTE = /^([^\s'""'""‘’“”]{1,30}(?:\s+[^\s'""'""‘’“”]{1,30}){0,2})\s+['""'"‘’“”]/;
//   "YYYY X CONCERT/TOUR/콘서트 ..."  →  X  (year prefix variant).
//   \b doesn't work after Korean in JS, so terminate with whitespace/end/punct.
const YEAR_PREFIX_CONCERT = /^20\d{2}\s+([^\s]{1,30}(?:\s+[^\s]{1,30}){0,3})\s+(?:CONCERT|TOUR|투어|콘서트|LIVE|라이브)(?:[\s\-–—'"."]|$)/i;
//   "X (Korean alias) ... LIVE/concert/POP-UP"  →  X.
const PAREN_ALIAS = /^([^\s\(（]{1,30}(?:\s+[^\s\(（]{1,30}){0,2})\s+[\(（][^\)）]{1,30}[\)）]/;
//   "X n주년 ..." or "X Nth ..." or "X35주년..." (no space)   →  X
const ANNIVERSARY = /^([^\s\d]{1,30}?)\s*(?:\d+\s*주년|\d+th|\d+nd|\d+rd|\d+st)/i;

// Multi-artist separators.
const MULTI_SEPS = /\s*(?:\bX\b|\bx\b|＆|&|\+|feat\.|with|콜라보(?:\s*with)?)\s*/i;

function decodeEntities(s: string): string {
  // Decode common HTML entities (sometimes double-encoded as &amp;#039;).
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'); // second pass for double-encoded cases
}

function extractCandidates(title: string): string[] {
  const tries: string[] = [];
  title = decodeEntities(title);
  // Strip ANYTHING after " - 도시명" suffix first (e.g., "- 대전", "- 부산") to
  // keep the body intact for pattern matching.
  let body = title.replace(/\s+[-–—]\s+(?:서울|부산|대구|인천|광주|대전|울산|세종|수원|성남|용인|고양|화성|창원|청주|전주|천안|평택|시흥|김해|안산|안양|남양주|의정부|진주|순천|경주|목포|군산|아산|양산|여수|원주|춘천|강릉)\s*$/u, '');

  const tryRe = (re: RegExp) => {
    const m = re.exec(body);
    if (m && m[1]) tries.push(m[1]);
  };
  // Highest signal first
  tryRe(BRACKETS_SOLO);
  if (tries.length === 0) tryRe(BRACKETS_CONCERT);
  if (tries.length === 0) tryRe(BARE_SOLO);
  if (tries.length === 0) tryRe(YEAR_PREFIX_CONCERT);
  if (tries.length === 0) tryRe(ANNIVERSARY);
  if (tries.length === 0) tryRe(PAREN_ALIAS);
  if (tries.length === 0) tryRe(BARE_TOUR);
  if (tries.length === 0) tryRe(BARE_CONCERT_CITY);
  if (tries.length === 0) tryRe(BARE_CONCERT_END);
  if (tries.length === 0) tryRe(BARE_RELEASE);
  if (tries.length === 0) tryRe(BRACKETS_FIRST_TOKEN);
  if (tries.length === 0) tryRe(BRACKETS_ANGLE);
  if (tries.length === 0) tryRe(BEFORE_QUOTE);
  if (tries.length === 0) tryRe(AFTER_COLON);
  if (tries.length === 0) tryRe(DASH_THEN_NAME);

  // expand multi-artist into separate names
  const expanded: string[] = [];
  for (const raw of tries) {
    const parts = raw.split(MULTI_SEPS).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      // strip parenthesized suffix like "잭킹콩(JKC)" -> "잭킹콩",
      // and any leading/trailing brackets/quotes/punct.
      let cleaned = p.replace(/[\(（][^)）]*[\)）]\s*$/, '').trim();
      cleaned = cleaned.replace(/^[\[\(（〈《「『\s'""'"]+|[\]\)）〉》」』\s'""'"]+$/gu, '');
      if (cleaned.length >= 1 && cleaned.length <= 30) expanded.push(cleaned);
    }
  }
  return Array.from(new Set(expanded));
}

const artistCache = new Map<string, string>(); // key -> id

async function findOrCreateArtist(name: string): Promise<string | null> {
  const canon = canonicalizeArtistName(name);
  if (!canon.key) return null;
  const cached = artistCache.get(canon.key);
  if (cached) return cached;

  const existing = await prisma.artist.findUnique({ where: { canonicalKey: canon.key } });
  if (existing) {
    // add this display variant to aliases if not already
    if (existing.canonicalName !== name && !existing.aliases.includes(name)) {
      await prisma.artist.update({
        where: { id: existing.id },
        data: { aliases: [...existing.aliases, name] },
      });
    }
    artistCache.set(canon.key, existing.id);
    return existing.id;
  }
  const created = await prisma.artist.create({
    data: { canonicalName: name, canonicalKey: canon.key, aliases: [] },
  });
  artistCache.set(canon.key, created.id);
  return created.id;
}

async function main() {
  // Target: Shows that came from festivallife concert (originalPostUrl prefix)
  // and currently have 0 linked artists.
  type Row = {
    id: string;
    title: string | null;
    date: Date | null;
    venueId: string | null;
    artist_count: bigint;
  };
  const rows = (await prisma.$queryRawUnsafe<Row[]>(`
    SELECT s.id, s.title, s.date, s."venueId",
           (SELECT COUNT(*) FROM "_ShowArtists" sa WHERE sa."B" = s.id) AS artist_count
    FROM "Show" s
    WHERE s."originalPostUrl" LIKE 'https://festivallife.kr/concert/%'
  `)) as Row[];

  console.log(`Loaded ${rows.length} festivallife concert shows`);

  let processed = 0;
  let extracted = 0;
  let linked = 0;
  let stillUnlinked = 0;
  const unmatchedSamples: string[] = [];

  for (const r of rows) {
    processed++;
    if (Number(r.artist_count) > 0) continue; // already has artists
    if (!r.title) {
      stillUnlinked++;
      continue;
    }
    const candidates = extractCandidates(r.title);
    if (candidates.length === 0) {
      stillUnlinked++;
      if (unmatchedSamples.length < 10) unmatchedSamples.push(r.title);
      continue;
    }
    extracted++;
    const artistIds: string[] = [];
    for (const name of candidates) {
      const id = await findOrCreateArtist(name);
      if (id) artistIds.push(id);
    }
    for (const aid of artistIds) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_ShowArtists" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        aid,
        r.id,
      );
    }
    // recompute completeness
    let comp = 0;
    if (r.date) comp++;
    if (r.venueId) comp++;
    if (artistIds.length > 0) comp++;
    const missing: string[] = [];
    if (!r.date) missing.push('date');
    if (!r.venueId) missing.push('venue');
    if (artistIds.length === 0) missing.push('artists');
    await prisma.show.update({
      where: { id: r.id },
      data: {
        completeness: comp,
        missingFields: missing,
        needsReview: comp < 3,
      },
    });
    linked++;
    if (linked % 100 === 0) console.log(`  ${linked} shows linked (processed ${processed}/${rows.length})`);
  }

  console.log();
  console.log(`Done.`);
  console.log(`  processed:     ${processed}`);
  console.log(`  extracted:     ${extracted}`);
  console.log(`  linked:        ${linked}`);
  console.log(`  unlinked:      ${stillUnlinked}`);
  console.log(`  new artists:   ${artistCache.size}`);
  if (unmatchedSamples.length) {
    console.log(`\nFirst 10 titles with no artist extracted (for pattern review):`);
    for (const t of unmatchedSamples) console.log(`    ${t}`);
  }

  console.log('Refreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
