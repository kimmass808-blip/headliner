/**
 * Phase A enrichment for Pentaport 2026:
 *  1. Parse pentaport IG dump alt text for day-by-day lineup.
 *  2. For each Show in DB tied to Pentaport 2026 that has no date,
 *     find the artist in the alt text and assign the inferred day.
 *
 * Strategy: vocabulary-driven matching. We do NOT try to extract artist
 * names from the noisy OCR alt text; instead we walk through each DB artist
 * (with their aliases) and search the alt text for which day section mentions
 * them. This is robust against punctuation noise / OCR garble.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const FESTIVAL_KEY = '인천펜타포트락페스티벌__2026';

// Day markers and the date each maps to. Captured from the 2026 announcement
// posters: FRI. JUL 31 / SAT. AUG 1 / SUN. AUG 2.
// Lenient patterns tolerate OCR doubling ("SUN. SUN.AUG AUG"), missing digit
// after AUG, and stray whitespace/punctuation between tokens.
const DAY_SECTIONS = [
  { pat: /FRI[\s.·•]*(?:FRI[\s.·•]*)?JUL[\s.·•]*(?:JUL[\s.·•]*)?\d?/i, date: '2026-07-31' },
  { pat: /SAT[\s.·•]*(?:SAT[\s.·•]*)?AUG[\s.·•]*(?:AUG[\s.·•]*)?\s*1\b/i, date: '2026-08-01' },
  { pat: /SUN[\s.·•]*(?:SUN[\s.·•]*)?AUG[\s.·•]*(?:AUG[\s.·•]*)?\s*\d?/i, date: '2026-08-02' },
] as const;

// Optional global end markers that close the last day's section.
const END_MARKERS = [/MORE\s*TO\s*COME/i, /주최/, /주관/, /후원/, /협찬/];

type PostAlt = { shortcode: string; url: string; alt: string };

function loadAlts(): PostAlt[] {
  const dir = resolve(__dirname, '..', 'crawler', 'dumps', 'pentaport');
  const files = readdirSync(dir).filter((f) => f.endsWith('-grid-v2.json'));
  // newest first
  files.sort().reverse();
  if (files.length === 0) throw new Error('no grid-v2 dump found in ' + dir);
  const path = join(dir, files[0]);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return (data.posts as any[])
    .filter((p) => p.alt)
    .map((p) => ({ shortcode: p.shortcode, url: p.url, alt: p.alt as string }));
}

/** Split alt text into day-keyed sections. Returns { date -> section text }. */
function splitByDay(alt: string): Record<string, string> {
  // Find all day-marker positions
  type Hit = { date: string; start: number; matchEnd: number };
  const hits: Hit[] = [];
  for (const { pat, date } of DAY_SECTIONS) {
    const m = pat.exec(alt);
    if (m) hits.push({ date, start: m.index, matchEnd: m.index + m[0].length });
  }
  if (hits.length === 0) return {};
  // Sort by appearance order
  hits.sort((a, b) => a.start - b.start);
  // Determine the end of the last section (first end-marker after it, or alt end)
  let altEnd = alt.length;
  const lastStart = hits[hits.length - 1].start;
  for (const em of END_MARKERS) {
    const m = em.exec(alt.slice(lastStart));
    if (m) {
      altEnd = Math.min(altEnd, lastStart + m.index);
    }
  }
  const sections: Record<string, string> = {};
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].matchEnd;
    const end = i + 1 < hits.length ? hits[i + 1].start : altEnd;
    sections[hits[i].date] = alt.slice(start, end);
  }
  return sections;
}

/** Build a name-matching predicate that's tolerant to whitespace/punctuation. */
function makeMatcher(name: string): RegExp {
  // Treat ' ', '·', '•', '"', tabs, NBSP, etc. as flexible separators between tokens.
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return /(?:)/;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('[\\s\\u00a0·•"\'`*•]{0,3}'), 'i');
}

async function main() {
  const festival = await prisma.festival.findUnique({ where: { canonicalKey: FESTIVAL_KEY } });
  if (!festival) {
    console.error('Festival not found for key', FESTIVAL_KEY);
    process.exit(1);
  }
  const alts = loadAlts();
  console.log(`Loaded ${alts.length} IG posts with alt text`);

  // Pre-split each post by day section
  const dayHits: { date: string; section: string; post: PostAlt }[] = [];
  for (const p of alts) {
    const sections = splitByDay(p.alt);
    for (const [date, section] of Object.entries(sections)) {
      if (section.trim().length > 5) dayHits.push({ date, section, post: p });
    }
  }
  console.log(`Found ${dayHits.length} day sections across posts (with content).`);

  // Load all shows for this festival via raw SQL because Prisma's implicit-M2M
  // include returns empty arrays in this codebase (likely a generated-client/
  // pgbouncer quirk). Aggregate aliases via array_agg so we get one row per show.
  type ShowRow = {
    id: string;
    date: Date | null;
    venueId: string | null;
    canonicalName: string | null;
    aliases: string[] | null;
  };
  const showRows = (await prisma.$queryRawUnsafe<ShowRow[]>(`
    SELECT s.id, s.date, s."venueId",
           a."canonicalName" AS "canonicalName",
           a.aliases AS aliases
    FROM "Show" s
    LEFT JOIN "_ShowArtists" sa ON sa."A" = s.id
    LEFT JOIN "Artist" a ON a.id = sa."B"
    WHERE s."festivalId" = $1
  `, festival.id)) as ShowRow[];

  // Multi-artist shows would appear as multiple rows -- collapse to (id, primaryArtist)
  // by taking the first row per show id. Acceptable here: pentaport rows are 1-artist.
  const seen = new Set<string>();
  const shows = showRows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).map((r) => ({
    id: r.id,
    date: r.date,
    venueId: r.venueId,
    artists: r.canonicalName
      ? [{ canonicalName: r.canonicalName, aliases: r.aliases ?? [] }]
      : [],
  }));

  let datedNow = 0;
  let alreadyDated = 0;
  let stillUnmatched = 0;
  const unmatched: string[] = [];

  for (const show of shows) {
    if (show.date) {
      alreadyDated++;
      continue;
    }
    const artist = show.artists[0];
    if (!artist) {
      unmatched.push('(show with no artist) ' + show.id);
      stillUnmatched++;
      continue;
    }
    const candidates = [artist.canonicalName, ...artist.aliases];
    let bestDate: string | null = null;
    let bestEvidence = '';
    for (const cand of candidates) {
      const re = makeMatcher(cand);
      for (const hit of dayHits) {
        if (re.test(hit.section)) {
          bestDate = hit.date;
          bestEvidence = `"${cand}" found in ${hit.post.shortcode} (${hit.date} section)`;
          break;
        }
      }
      if (bestDate) break;
    }
    if (bestDate) {
      await prisma.show.update({
        where: { id: show.id },
        data: { date: new Date(bestDate), needsReview: false },
      });
      // tighten completeness if we now have date+venue+artist
      const has = (v: any) => v != null;
      const venueOk = has(show.venueId);
      let comp = 0;
      if (has(bestDate)) comp++;
      if (venueOk) comp++;
      if (artist) comp++;
      await prisma.show.update({
        where: { id: show.id },
        data: { completeness: Math.min(comp, 3) },
      });
      console.log(`  ✓ ${artist.canonicalName} → ${bestDate}  (${bestEvidence})`);
      datedNow++;
    } else {
      console.log(`  ✗ ${artist.canonicalName} — no day-section match`);
      unmatched.push(artist.canonicalName);
      stillUnmatched++;
    }
  }

  console.log();
  console.log(`Result:`);
  console.log(`  already had date: ${alreadyDated}`);
  console.log(`  newly dated:      ${datedNow}`);
  console.log(`  still unmatched:  ${stillUnmatched}`);
  if (unmatched.length) console.log(`    ${unmatched.join(', ')}`);

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
