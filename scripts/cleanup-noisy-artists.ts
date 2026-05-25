/**
 * Remove obviously-non-artist rows from Artist table that were created by the
 * over-aggressive concert title regex extractor.
 *
 * Rules (all case-insensitive, applied to canonicalName after trim):
 *  1) Exact blacklist: years, month words, generic Korean fillers, common
 *     English filler tokens.
 *  2) Regex patterns: "20\d{2} ...", contains "주년", ends with concert keyword.
 *  3) Trailing-token strip: "쏜애플 콘서트" -> tries "쏜애플". If "쏜애플"
 *     already exists, transfer the link to it and delete the dirty one.
 *
 * Run with `--dry-run` to preview without writing.
 */

import { PrismaClient } from '@prisma/client';
import { canonicalizeArtistName } from '@mft/canonicalize';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const DRY_RUN = process.argv.includes('--dry-run');

// 1) Exact blacklist (after .trim().toLowerCase()).
const EXACT_BLACKLIST = new Set<string>([
  // Years
  ...[...Array(15)].map((_, i) => String(2018 + i)),
  // City names (often left over after city-stripper failed)
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '수원',
  '성남', '용인', '고양', '화성', '창원', '청주', '전주', '천안', '평택',
  '시흥', '김해', '안산', '안양', '남양주', '의정부', '진주', '순천', '경주',
  '목포', '군산', '아산', '양산', '여수', '원주', '춘천', '강릉',
  // Korean noise tokens
  '기념', '연말', '매일', '발매', '발매기념', '마지막', '새', '호랑이', '이브',
  '콘서트', '공연', '라이브', '단독', '쇼케이스', '투어', '시즌', '패키지',
  '라인업', '오왠의', '튠업', '고고학', '오월오일', '고요한', '초승', '손을모아',
  '합주와', '윤2', '윤3', '윤4',
  // English noise
  'get,', 'get', 'the', 'party', 'suddenly', 'harvest', 'odyssey', 'attention',
  'love', 'play', 'club', 'we', 'kids', 'live', 'and', 'with', 'for',
  // Standalone single-letter / extremely short tokens added by regex slop
  'x', '+', '&', 'feat',
]);

// 2) Regex patterns -- match if true
const NOISE_PATTERNS: RegExp[] = [
  /^20\d{2}\s+\S+/,         // year-prefixed concert names
  /주년/,                    // anniversary phrases
  /^〈|〉$|^《|》$/,          // angle-bracket fragments
  /^[\[\(（「『〈《｟［｛【〚｢]/, // starts with open bracket (no close)
  /\s+(?:콘서트|공연|라이브|단독|투어|쇼케이스|시즌|클럽투어|전국|전국투어|라이브쇼)\s*$/i,
  /^(?:MINTPAPER|롤링|먼데이프로젝트|클럽\s*온에어)/i,  // event-brand prefixes
];

// 3) Strippable affixes -- run trailing + leading until the name stabilizes.
const STRIPPABLE_TAIL = /\s+(?:콘서트|공연|쇼|라이브|단독|단독공연|단독콘서트|투어|쇼케이스|클럽투어|전국|전국투어|소극장|발매|발매기념|연말|기념|\d+(?:st|nd|rd|th)|2024|2025|2026|2023|2022|2021|2020)$/i;
const STRIPPABLE_LEAD = /^(?:20\d{2}|제?\d+회)\s+/;
// Quoted subtitle like  '...'  or  ‘...’  or  "..." at end of name
const STRIPPABLE_QUOTE_TAIL = /\s+['"""'""""'][^'"""'""""'']{1,40}['"""'""""''].*$/;

type Row = { id: string; canonicalName: string; canonicalKey: string; show_count: number };

function isNoise(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (EXACT_BLACKLIST.has(t.toLowerCase())) return true;
  for (const re of NOISE_PATTERNS) if (re.test(t)) return true;
  // pure punctuation (Unicode-aware: Korean/Latin letters count as letters)
  if (/^[^\p{L}\p{N}]+$/u.test(t)) return true;
  return false;
}

function tryRecover(name: string): string | null {
  let cur = name;
  for (let i = 0; i < 5; i++) {
    const next = cur
      .replace(STRIPPABLE_LEAD, '')
      .replace(STRIPPABLE_QUOTE_TAIL, '')
      .replace(STRIPPABLE_TAIL, '')
      .trim();
    if (next === cur) break;
    cur = next;
  }
  if (cur === name) return null;
  if (!cur) return null;
  if (isNoise(cur)) return null;
  return cur;
}

async function main() {
  const rows = (await prisma.$queryRawUnsafe<Row[]>(`
    SELECT a.id, a."canonicalName", a."canonicalKey",
           (SELECT COUNT(*) FROM "_ShowArtists" sa WHERE sa."A" = a.id)::int AS show_count
    FROM "Artist" a
  `)) as Row[];
  console.log(`Loaded ${rows.length} artists`);

  const toDelete: Row[] = [];
  const toRecover: { row: Row; newName: string }[] = [];

  for (const r of rows) {
    // Try to recover a clean name first; only fall back to delete if the
    // stripped form is still noise or recovery fails.
    const recovered = tryRecover(r.canonicalName);
    if (recovered && recovered !== r.canonicalName) {
      toRecover.push({ row: r, newName: recovered });
      continue;
    }
    if (isNoise(r.canonicalName)) {
      toDelete.push(r);
    }
  }

  console.log(`\n[DRY-RUN: ${DRY_RUN}]`);
  console.log(`Plan:`);
  console.log(`  delete (pure noise): ${toDelete.length}`);
  console.log(`  rename/merge (strip trailing tail): ${toRecover.length}`);

  console.log(`\n--- delete sample (first 30) ---`);
  for (const r of toDelete.slice(0, 30)) {
    console.log(`  [${r.show_count}] ${r.canonicalName}`);
  }
  console.log(`--- rename sample (first 20) ---`);
  for (const r of toRecover.slice(0, 20)) {
    console.log(`  [${r.row.show_count}] ${r.row.canonicalName}  ->  ${r.newName}`);
  }

  if (DRY_RUN) {
    console.log('\n(dry-run: no changes applied. Re-run without --dry-run to execute.)');
    return;
  }

  let deletedShows = 0;
  let deletedArtists = 0;
  let renamed = 0;
  let merged = 0;

  // Step 1: delete pure noise artists -- remove links then delete
  for (const r of toDelete) {
    const linkDel = await prisma.$executeRawUnsafe(
      `DELETE FROM "_ShowArtists" WHERE "A" = $1`,
      r.id,
    );
    deletedShows += linkDel;
    await prisma.artist.delete({ where: { id: r.id } });
    deletedArtists++;
  }

  // Step 2: recover -- if target exists, merge; else rename
  for (const { row, newName } of toRecover) {
    const canon = canonicalizeArtistName(newName);
    if (!canon.key) continue;
    const target = await prisma.artist.findUnique({ where: { canonicalKey: canon.key } });
    if (target && target.id !== row.id) {
      // merge: re-link this artist's shows to target, then delete this artist
      // and add this name to target's aliases
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_ShowArtists" ("A", "B")
         SELECT $1, "B" FROM "_ShowArtists" WHERE "A" = $2
         ON CONFLICT DO NOTHING`,
        target.id,
        row.id,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM "_ShowArtists" WHERE "A" = $1`, row.id);
      const newAliases = Array.from(new Set([...target.aliases, row.canonicalName]));
      await prisma.artist.update({
        where: { id: target.id },
        data: { aliases: newAliases },
      });
      await prisma.artist.delete({ where: { id: row.id } });
      merged++;
    } else {
      // rename in place
      await prisma.artist.update({
        where: { id: row.id },
        data: {
          canonicalName: newName,
          canonicalKey: canon.key,
          aliases: Array.from(new Set([row.canonicalName, ...(await prisma.artist.findUnique({ where: { id: row.id }, select: { aliases: true } }))!.aliases])),
        },
      });
      renamed++;
    }
  }

  // Step 3: recompute completeness for shows that lost an artist link
  console.log(`\nRecomputing Show completeness...`);
  await prisma.$executeRawUnsafe(`
    UPDATE "Show" s SET
      completeness = (CASE WHEN date IS NULL THEN 0 ELSE 1 END)
                   + (CASE WHEN "venueId" IS NULL THEN 0 ELSE 1 END)
                   + (CASE WHEN EXISTS (SELECT 1 FROM "_ShowArtists" sa WHERE sa."B" = s.id) THEN 1 ELSE 0 END),
      "needsReview" = (
        date IS NULL OR "venueId" IS NULL
        OR NOT EXISTS (SELECT 1 FROM "_ShowArtists" sa WHERE sa."B" = s.id)
      )
  `);

  console.log(`\nDone.`);
  console.log(`  artists deleted (noise):    ${deletedArtists}`);
  console.log(`  artists renamed (recovery): ${renamed}`);
  console.log(`  artists merged into existing: ${merged}`);
  console.log(`  _ShowArtists links removed:  ${deletedShows}`);

  const stillNoArtist: any = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as c FROM "Show" s
    WHERE NOT EXISTS (SELECT 1 FROM "_ShowArtists" sa WHERE sa."B" = s.id)
  `);
  console.log(`  shows with no artist now:    ${stillNoArtist[0].c} / ${await prisma.show.count()}`);

  console.log('\nRefreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
