/**
 * Import festivallife.kr/concert candidates.json into Show records.
 *
 * Strategy:
 *  - originalPostUrl (festivallife URL) is the natural key.
 *  - Canonicalize venueText -> upsert Venue, link by venueId.
 *  - Reject implausible dates (year < 2000 or > 2030) to weed out OCR noise.
 *  - Artists not parsed here; Shows go in with 0 artists, needsReview=true.
 *    Operator can fill artist later via admin UI or a follow-up LLM pass.
 *  - completeness 0..3 = date + venue + artists≥1.
 *
 * Idempotent: re-running updates existing Shows by originalPostUrl without
 * duplication.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { canonicalizeVenueText } from '@mft/canonicalize';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

type Candidate = {
  idx: string;
  title: string;
  rawTitle: string;
  date: string | null;
  startTime: string | null;
  venueText: string | null;
  image: string | null;
  sourceUrl: string;
  rawDescription: string;
};

function plausibleDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 2000 || y > 2030) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Cache so we don't upsert the same venue 100x in a row.
const venueCache = new Map<string, string>(); // canonicalKey -> id

async function getOrCreateVenue(venueText: string): Promise<string | null> {
  const canon = canonicalizeVenueText(venueText);
  if (!canon.key) return null;
  const cached = venueCache.get(canon.key);
  if (cached) return cached;

  const existing = await prisma.venue.findUnique({ where: { canonicalKey: canon.key } });
  if (existing) {
    venueCache.set(canon.key, existing.id);
    return existing.id;
  }
  const created = await prisma.venue.create({
    data: {
      name: canon.display,
      canonicalKey: canon.key,
    },
  });
  venueCache.set(canon.key, created.id);
  return created.id;
}

async function main() {
  const path = resolve(__dirname, '..', 'crawler', 'dumps', 'festivallife-concert', 'candidates.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const items: Candidate[] = raw.items;
  console.log(`Loaded ${items.length} concert candidates`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let venuesCreated = 0;
  const venuesBefore = await prisma.venue.count();

  for (const c of items) {
    const date = plausibleDate(c.date);
    const hasVenue = !!(c.venueText && c.venueText.trim());
    // Need at least one of date/venue/title to be worth recording
    if (!date && !hasVenue && !c.title) {
      skipped++;
      continue;
    }
    let venueId: string | null = null;
    if (hasVenue) {
      try {
        venueId = await getOrCreateVenue(c.venueText!);
      } catch (e) {
        // canonicalize might reject some -- swallow and leave venueId null
      }
    }
    const missingFields: string[] = [];
    if (!date) missingFields.push('date');
    if (!venueId) missingFields.push('venue');
    missingFields.push('artists'); // we don't parse them
    let completeness = 0;
    if (date) completeness++;
    if (venueId) completeness++;
    // artists==0 always at import time
    const data = {
      date,
      startTime: c.startTime,
      venueId,
      title: c.title || null,
      originalPostUrl: c.sourceUrl,
      imageUrl: c.image,
      rawTextExcerpt: c.rawDescription?.slice(0, 1000) || null,
      stage: null,
      setOrder: null,
      completeness,
      missingFields,
      needsReview: completeness < 3 || true, // always review until artists linked
    };

    const existing = await prisma.show.findUnique({ where: { originalPostUrl: c.sourceUrl } });
    if (existing) {
      await prisma.show.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.show.create({ data });
      inserted++;
    }

    if ((inserted + updated) % 100 === 0) {
      console.log(`  ${inserted + updated} / ${items.length} (ins=${inserted} upd=${updated} skip=${skipped})`);
    }
  }

  const venuesAfter = await prisma.venue.count();
  venuesCreated = venuesAfter - venuesBefore;

  console.log();
  console.log(`Done.`);
  console.log(`  inserted: ${inserted}`);
  console.log(`  updated:  ${updated}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  venues created (net): ${venuesCreated}`);

  const showTotal = await prisma.show.count();
  console.log(`  Show rows now: ${showTotal}`);

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
