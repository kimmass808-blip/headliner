/**
 * Prefix Festival.name with year so the display differentiates editions
 * (e.g. "인천 펜타포트 락 페스티벌" -> "2026 인천 펜타포트 락 페스티벌").
 *
 * Year source: canonicalKey ends with "__YYYY" (set by dedupe-festivals
 * or import-festivallife). startDate is a fallback.
 *
 * Idempotent: if the year already appears at the start of the name, skip.
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const YEAR_PAT = /\b(20\d{2})\b/;
const KEY_YEAR = /__(\d{4})$/;

async function main() {
  const festivals = await prisma.festival.findMany({
    select: { id: true, name: true, canonicalKey: true, startDate: true, aliases: true },
  });
  console.log(`Loaded ${festivals.length} festivals`);

  let updated = 0;
  let alreadyPrefixed = 0;
  let noYear = 0;

  for (const f of festivals) {
    // determine year
    let year: number | null = null;
    const keyMatch = KEY_YEAR.exec(f.canonicalKey);
    if (keyMatch) year = Number(keyMatch[1]);
    else if (f.startDate) year = f.startDate.getUTCFullYear();
    if (!year) {
      noYear++;
      continue;
    }
    const prefix = `${year} `;
    // already prefixed?
    if (f.name.startsWith(prefix)) {
      alreadyPrefixed++;
      continue;
    }
    // strip any year occurrence to avoid double-year ("2026 ... 2026 ...")
    let stripped = f.name.replace(YEAR_PAT, '').replace(/\s{2,}/g, ' ').trim();
    const newName = `${prefix}${stripped}`;
    // keep original as alias for searchability
    const newAliases = Array.from(new Set([...f.aliases, f.name]));
    await prisma.festival.update({
      where: { id: f.id },
      data: { name: newName, aliases: newAliases },
    });
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} updated...`);
  }

  console.log(`\nDone.`);
  console.log(`  updated:          ${updated}`);
  console.log(`  already prefixed: ${alreadyPrefixed}`);
  console.log(`  no year:          ${noYear}`);

  console.log('Refreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
