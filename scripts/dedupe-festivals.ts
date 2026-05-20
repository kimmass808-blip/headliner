/**
 * Merge duplicate Festival rows that refer to the same festival edition
 * (same normalized name + same year).
 *
 * Why: IG seed and festivallife import generated different canonicalKey values
 * for the same festival (whitespace + ordering differences). The user wants
 * latest data (text + image) to win.
 *
 * Strong key:
 *   - strip all whitespace from name (also strip leading year)
 *   - lowercase
 *   - append + year (parsed from name OR from startDate)
 *
 * Merge policy (latest wins for primary fields, union for aliases):
 *   - winner = row with the most filled fields (poster + locationText + description
 *     + officialUrl + dates + at-least-one-Show); tiebreaker = max updatedAt
 *   - copy NON-NULL fields from loser into winner if winner missing them
 *   - aliases = union of all rows' aliases + losers' names
 *   - reassign Show.festivalId from losers to winner
 *   - delete losers
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const YEAR_PAT = /\b(20\d{2})\b/;

// Invisible chars (BOM, zero-width) that break equality.
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;

// Same iteration suffix stripping as crawler/analyze/festivallife.py.
// Handles both dash-separated and trailing-no-dash variants so old DB rows
// that retain the iteration phrase in their name still collapse to the base.
const ITERATION_AFTER_DASH = /\s*[-–—]\s*.*$/;
const TRAILING_TOKENS = new RegExp(
  '\\s+(?:' +
    '개최\\s*확정|개최\\s*일정?\\s*발표|개최일\\s*발표|개최\\s*취소|취소|연기|' +
    '라인업(?:\\s*발표|\\s*공개)?|타임테이블|일정\\s*공개|장소\\s*공개|' +
    '헤드라이너\\s*공개|티켓\\s*오픈|굿즈|기념품|후기|리뷰|영상|티저|' +
    '\\d+차(?:\\s*라인업)?|최종(?:\\s*라인업)?|얼리버드|' +
    '개최|발표|공개|예고|일정|장소|패키지|예매' +
    ')\\s*$',
);

function stripIterationTokens(name: string): string {
  let t = name.replace(INVISIBLE, '').trim();
  t = t.replace(ITERATION_AFTER_DASH, '').trim();
  for (let i = 0; i < 3; i++) {
    const n = t.replace(TRAILING_TOKENS, '').trim();
    if (n === t) break;
    t = n;
  }
  return t;
}

function strongKey(name: string, startDate: Date | null, existingKey?: string | null): string | null {
  const base = stripIterationTokens(name);
  const yMatchInName = YEAR_PAT.exec(base);
  // Fallback ladder: year-in-name -> startDate.year -> year-in-existingCanonicalKey.
  // The last fallback covers stale rows whose name lost the year but whose key
  // (set by an earlier import) still encodes it.
  let year: number | null = null;
  if (yMatchInName != null) year = Number(yMatchInName[1]);
  else if (startDate) year = startDate.getUTCFullYear();
  else if (existingKey) {
    const m = /__(\d{4})$/.exec(existingKey);
    if (m) year = Number(m[1]);
  }
  if (year == null) return null;
  // strip year, then all whitespace, then lowercase
  const cleaned = base
    .replace(YEAR_PAT, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\w가-힯]/g, ''); // keep alnum + Korean
  if (!cleaned) return null;
  return `${cleaned}__${year}`;
}

type Row = Awaited<ReturnType<typeof prisma.festival.findMany>>[number] & {
  _showCount: number;
};

function fillScore(row: Row): number {
  let s = 0;
  if (row.startDate) s++;
  if (row.endDate) s++;
  if (row.locationText) s++;
  if (row.description) s++;
  if (row.posterImageUrl) s++;
  if (row.officialUrl) s++;
  if (row.ticketUrl) s++;
  if (row.venueId) s++;
  if (row.igHandle) s++;
  if (row._showCount > 0) s += 2; // shows linked => high signal
  return s;
}

async function main() {
  const all = await prisma.festival.findMany({
    include: { _count: { select: { shows: true } } },
  });
  console.log(`Loaded ${all.length} festival rows`);

  // group by strong key
  const groups = new Map<string, Row[]>();
  const unkeyed: any[] = [];
  for (const f of all) {
    const row: Row = { ...f, _showCount: f._count.shows };
    const k = strongKey(row.name, row.startDate, row.canonicalKey);
    if (!k) {
      unkeyed.push(row);
      continue;
    }
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }

  const dupes = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  console.log(`groups: ${groups.size} | duplicate groups: ${dupes.length} | unkeyed: ${unkeyed.length}`);

  let mergedRows = 0;
  let deletedRows = 0;
  let reassignedShows = 0;

  for (const [key, rows] of dupes) {
    // pick winner: max fillScore, tiebreak latest updatedAt
    rows.sort((a, b) => {
      const sa = fillScore(a);
      const sb = fillScore(b);
      if (sa !== sb) return sb - sa;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const winner = rows[0];
    const losers = rows.slice(1);

    // union aliases + add losers' display names
    const allAliases = new Set<string>(winner.aliases);
    for (const l of losers) {
      for (const a of l.aliases) allAliases.add(a);
      if (l.name && l.name !== winner.name) allAliases.add(l.name);
    }

    // fill winner's null fields from any loser
    const patch: any = {};
    for (const l of losers) {
      if (!winner.startDate && l.startDate) patch.startDate = l.startDate;
      if (!winner.endDate && l.endDate) patch.endDate = l.endDate;
      if (!winner.locationText && l.locationText) patch.locationText = l.locationText;
      if (!winner.description && l.description) patch.description = l.description;
      if (!winner.posterImageUrl && l.posterImageUrl) patch.posterImageUrl = l.posterImageUrl;
      if (!winner.officialUrl && l.officialUrl) patch.officialUrl = l.officialUrl;
      if (!winner.ticketUrl && l.ticketUrl) patch.ticketUrl = l.ticketUrl;
      if (!winner.venueId && l.venueId) patch.venueId = l.venueId;
      if (!winner.igHandle && l.igHandle) patch.igHandle = l.igHandle;
    }
    patch.aliases = Array.from(allAliases);
    // Realign canonicalKey to the strong-key scheme so future imports merge correctly.
    if (winner.canonicalKey !== key) patch.canonicalKey = key;
    // Clean iteration tokens out of the display name; keep original variants in aliases.
    const cleanedName = stripIterationTokens(winner.name);
    if (cleanedName && cleanedName !== winner.name) patch.name = cleanedName;
    // recompute completeness
    const has = (v: any) => v !== null && v !== undefined;
    const newStart = patch.startDate ?? winner.startDate;
    const newLoc = patch.locationText ?? winner.locationText;
    let completeness = 0;
    if (has(newStart)) completeness++;
    if (has(newLoc)) completeness++;
    patch.completeness = Math.min(completeness, 2);
    patch.needsReview = completeness < 2;

    // reassign Show.festivalId from losers to winner
    const loserIds = losers.map((l) => l.id);
    const upd = await prisma.show.updateMany({
      where: { festivalId: { in: loserIds } },
      data: { festivalId: winner.id },
    });
    reassignedShows += upd.count;

    // delete losers FIRST so we can rename winner's canonicalKey without
    // colliding on the unique constraint with a loser holding the same key.
    const del = await prisma.festival.deleteMany({ where: { id: { in: loserIds } } });
    deletedRows += del.count;
    // apply patch (including possible canonicalKey rename)
    await prisma.festival.update({ where: { id: winner.id }, data: patch });
    mergedRows++;

    console.log(
      `  [${key}] keep=${winner.id} (score=${fillScore(winner)}) ` +
        `drop=${losers.length} shows_reassigned=${upd.count}`,
    );
  }

  console.log(`\nDone.`);
  console.log(`  groups merged: ${mergedRows}`);
  console.log(`  rows deleted: ${deletedRows}`);
  console.log(`  shows reassigned: ${reassignedShows}`);
  if (unkeyed.length > 0) {
    console.log(`  unkeyed (skipped, no year): ${unkeyed.length}`);
    for (const u of unkeyed.slice(0, 5)) console.log(`    - ${u.name}`);
  }

  const final = await prisma.festival.count();
  console.log(`\nFestival rows now: ${final}`);

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
