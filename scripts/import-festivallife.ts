/**
 * Import festivallife.kr analyzer output (candidates.json) into Festival table.
 *
 * Strategy:
 * - canonicalKey = canonicalizeArtistName(baseName).key + '_' + year
 * - upsert by canonicalKey
 * - completeness: 0 = name only, 1 = +date, 2 = +date +location
 * - aliases[] accumulates baseName variants seen in source
 *
 * Idempotent: re-running updates existing rows without duplicating.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
const YEAR_PAT = /\b(20\d{2})\b/;

/**
 * Strong canonical key shared with scripts/dedupe-festivals.ts.
 * Strip year + all whitespace + non-alphanumeric to ensure same-festival
 * rows collide across data sources (IG, festivallife, manual).
 */
function strongKey(name: string, year: number | null): string | null {
  const y = year ?? (Number(YEAR_PAT.exec(name)?.[1]) || null);
  if (!y) return null;
  const cleaned = name
    .replace(YEAR_PAT, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\w가-힯]/g, '');
  if (!cleaned) return null;
  return `${cleaned}__${y}`;
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

type Candidate = {
  baseName: string;
  year: number | null;
  parsedDate: { start: string; end: string } | null;
  parsedVenue: string | null;
  latestIdx: string;
  latestTitle: string;
  latestHref: string;
  thumbnail: string | null;
  og_image: string | null;
  description: string;
  postCount: number;
  allPostIdxs: string[];
};

function buildKey(baseName: string, year: number | null): string | null {
  // Use the strong key (matches scripts/dedupe-festivals.ts) so re-imports
  // collide with rows created by other sources.
  return strongKey(baseName, year);
}

function computeCompleteness(c: Candidate): number {
  let score = 0; // name always present
  if (c.parsedDate?.start) score += 1;
  if (c.parsedVenue) score += 1;
  return Math.min(score, 2);
}

async function main() {
  const path = resolve(__dirname, '..', 'crawler', 'dumps', 'festivallife', 'candidates.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const festivals: Candidate[] = raw.festivals;

  console.log(`Loaded ${festivals.length} festival candidates`);

  let inserted = 0,
    updated = 0,
    skipped = 0;

  for (const c of festivals) {
    const canonicalKey = buildKey(c.baseName, c.year);
    if (!canonicalKey) {
      skipped++;
      continue; // no year => no stable key
    }

    const startDate = c.parsedDate ? new Date(c.parsedDate.start) : null;
    const endDate = c.parsedDate ? new Date(c.parsedDate.end) : null;
    const completeness = computeCompleteness(c);

    // posterImageUrl preference: og_image > thumbnail
    const poster = c.og_image || c.thumbnail || null;

    const data = {
      name: c.baseName,
      canonicalKey,
      aliases: [c.baseName, c.latestTitle].filter(
        (v, i, a) => v && a.indexOf(v) === i,
      ) as string[],
      startDate,
      endDate,
      locationText: c.parsedVenue,
      officialUrl: c.latestHref,
      posterImageUrl: poster,
      description: c.description || null,
      completeness,
      needsReview: completeness < 2,
    };

    const existing = await prisma.festival.findUnique({ where: { canonicalKey } });
    if (existing) {
      // merge aliases
      const mergedAliases = Array.from(new Set([...existing.aliases, ...data.aliases]));
      await prisma.festival.update({
        where: { canonicalKey },
        data: { ...data, aliases: mergedAliases },
      });
      updated++;
    } else {
      await prisma.festival.create({ data });
      inserted++;
    }
  }

  console.log(`Inserted: ${inserted}  Updated: ${updated}  Skipped (no year): ${skipped}`);

  // verify counts
  const total = await prisma.festival.count();
  console.log(`Festival table total rows: ${total}`);

  // Refresh search_index so the new festivals are immediately searchable.
  // (pg_cron refreshes every 15min on its own, but doing it now avoids the lag.)
  console.log('Refreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('search_index refreshed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
