/**
 * Merge duplicate Venue rows.
 *
 * Phase 1: strict normalization — strip HTML entities, all whitespace,
 *          non-alphanumeric/non-Korean chars, lowercase.
 *          Same normalized key => same venue.
 *
 * For each duplicate group:
 *   - winner = highest show_count, tiebreak shortest cleaned name
 *   - move Show.venueId from losers to winner
 *   - record each loser.name as a VenueAlias of the winner (addedBy='auto')
 *   - delete loser Venue rows
 *
 * Idempotent: re-running finds zero duplicates after the first pass.
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#0?39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&'); // second pass for double-encoded
}

function strongKey(name: string): string {
  const decoded = decodeEntities(name);
  // Strip all whitespace + non-alnum/Korean
  return decoded
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\w가-힯]/g, '');
}

type Row = {
  id: string;
  name: string;
  canonicalKey: string;
  show_count: number;
};

async function main() {
  const all = (await prisma.$queryRawUnsafe<Row[]>(`
    SELECT v.id, v.name, v."canonicalKey",
           (SELECT COUNT(*) FROM "Show" s WHERE s."venueId" = v.id)::int AS show_count
    FROM "Venue" v
  `)) as Row[];
  console.log(`Loaded ${all.length} venues`);

  // Group by strong key
  const groups = new Map<string, Row[]>();
  for (const v of all) {
    const k = strongKey(v.name);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(v);
  }
  const dups = [...groups.entries()].filter(([, g]) => g.length > 1);
  console.log(`Duplicate groups: ${dups.length}`);

  let mergedGroups = 0;
  let venuesDeleted = 0;
  let showsReassigned = 0;
  let aliasesAdded = 0;

  for (const [key, group] of dups) {
    // winner = most shows, then shortest decoded name
    group.sort((a, b) => {
      if (b.show_count !== a.show_count) return b.show_count - a.show_count;
      return decodeEntities(a.name).trim().length - decodeEntities(b.name).trim().length;
    });
    const winner = group[0];
    const losers = group.slice(1);
    const loserIds = losers.map((l) => l.id);

    // 1) reassign shows
    const upd = await prisma.show.updateMany({
      where: { venueId: { in: loserIds } },
      data: { venueId: winner.id },
    });
    showsReassigned += upd.count;

    // 2) record loser names as aliases (skip if already aliased)
    for (const loser of losers) {
      const aliasText = decodeEntities(loser.name).trim();
      if (!aliasText || aliasText === winner.name) continue;
      try {
        await prisma.venueAlias.create({
          data: {
            canonicalKey: winner.canonicalKey,
            alias: aliasText,
            addedBy: 'auto',
          },
        });
        aliasesAdded++;
      } catch {
        // unique violation on alias — already exists, ignore
      }
    }

    // 3) clean winner's name too (HTML decode + trim)
    const cleanedName = decodeEntities(winner.name).trim().replace(/\s+/g, ' ');
    if (cleanedName !== winner.name) {
      await prisma.venue.update({ where: { id: winner.id }, data: { name: cleanedName } });
    }

    // 4) delete loser venues
    const del = await prisma.venue.deleteMany({ where: { id: { in: loserIds } } });
    venuesDeleted += del.count;
    mergedGroups++;
    console.log(`  [${key}] keep="${cleanedName}" (${winner.show_count} shows), dropped ${losers.length}, +shows reassigned=${upd.count}`);
  }

  // Also: clean up any HTML entities / leading nbsp in venue names that are not duplicates.
  const remaining = await prisma.venue.findMany({});
  let cleanedSolo = 0;
  for (const v of remaining) {
    const cleaned = decodeEntities(v.name).trim().replace(/\s+/g, ' ');
    if (cleaned !== v.name && cleaned) {
      await prisma.venue.update({ where: { id: v.id }, data: { name: cleaned } });
      cleanedSolo++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  merged groups:     ${mergedGroups}`);
  console.log(`  venues deleted:    ${venuesDeleted}`);
  console.log(`  shows reassigned:  ${showsReassigned}`);
  console.log(`  aliases recorded:  ${aliasesAdded}`);
  console.log(`  names cleaned:     ${cleanedSolo}`);
  const total = await prisma.venue.count();
  console.log(`  Venue rows now:    ${total}`);

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
