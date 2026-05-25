/**
 * Clean concert Show.title fields.
 *
 * Strategy: many festivallife concert titles bundle promoter + series + artist
 * + actual show title together. The "real" show title usually appears inside
 * single or double quotes. Pull that out as the new title.
 *
 * Examples:
 *   "먼데이프로젝트 시즌9 [사기소멀 단독 콘서트 '마지막 고요']"
 *      -> "마지막 고요"
 *   "쏜애플 콘서트 '도시전설'"
 *      -> "도시전설"
 *   "오월오일 전국 클럽 투어 〈Harvest Days〉"
 *      -> "Harvest Days"   (angle quotes treated like quotes)
 *   "먼데이프로젝트X숲세권 MONDAY:SOOP [아사달 단독 콘서트]"
 *      -> (no quote) -> leave as-is
 *
 * For each Show with a quoted subtitle, we set title to the subtitle and
 * stash the original in rawTextExcerpt (prefixed with "원제: ") so it's
 * still searchable / recoverable.
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

// Pairs of (open, close) quote/bracket marks that wrap a subtitle.
const QUOTE_PAIRS: Array<[string, string]> = [
  ["'", "'"],
  ['"', '"'],
  ['‘', '’'],
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
  ['〈', '〉'],
  ['《', '》'],
  ['｟', '｠'],
];

function findQuotedSubtitle(title: string): string | null {
  let best: string | null = null;
  for (const [open, close] of QUOTE_PAIRS) {
    let i = 0;
    while (true) {
      const start = title.indexOf(open, i);
      if (start === -1) break;
      const end = title.indexOf(close, start + open.length);
      if (end === -1) break;
      const inner = title.slice(start + open.length, end).trim();
      if (inner.length >= 2 && inner.length <= 60) {
        if (!best || inner.length > best.length) best = inner;
      }
      i = end + close.length;
    }
  }
  return best;
}

async function main() {
  const shows = await prisma.show.findMany({
    where: { originalPostUrl: { startsWith: 'https://festivallife.kr/concert/' } },
    select: { id: true, title: true, rawTextExcerpt: true },
  });
  console.log(`Loaded ${shows.length} concert shows`);

  let updated = 0;
  let unchanged = 0;
  let alreadyClean = 0;
  for (const s of shows) {
    if (!s.title) {
      unchanged++;
      continue;
    }
    const sub = findQuotedSubtitle(s.title);
    if (!sub) {
      unchanged++;
      continue;
    }
    if (sub === s.title) {
      alreadyClean++;
      continue;
    }
    // store original in rawTextExcerpt prefix (skip if already prefixed)
    const origPrefix = `원제: ${s.title}`;
    const newRaw =
      s.rawTextExcerpt && s.rawTextExcerpt.startsWith('원제:')
        ? s.rawTextExcerpt
        : `${origPrefix}\n${s.rawTextExcerpt ?? ''}`.slice(0, 1000);

    await prisma.show.update({
      where: { id: s.id },
      data: { title: sub, rawTextExcerpt: newRaw },
    });
    updated++;
  }
  console.log(`\nDone.`);
  console.log(`  shows updated:      ${updated}`);
  console.log(`  no quoted subtitle: ${unchanged}`);
  console.log(`  already clean:      ${alreadyClean}`);

  console.log('Refreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
