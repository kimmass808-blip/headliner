/**
 * Decode HTML entities in stored text fields (Show.title, Show.rawTextExcerpt,
 * Festival.description, Festival.name) that were stored verbatim from
 * og:title / og:description meta tags.
 *
 * Idempotent: re-running on already-decoded text is a no-op.
 *
 * Common encodings observed in festivallife.kr:
 *   &amp;  -> &
 *   &lt;   -> <
 *   &gt;   -> >
 *   &quot; -> "
 *   &#039; -> '
 *   &nbsp; -> (space)
 *
 * We also handle double-encoded forms (&amp;lt; -> &lt; -> <) via a 2-pass decode.
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

function decode(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#0?39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&');
    if (out === before) break;
  }
  return out;
}

const HAS_ENTITY = /&(?:amp|lt|gt|quot|nbsp|#0?39);/i;

async function main() {
  // Shows
  const shows = await prisma.show.findMany({
    where: {
      OR: [
        { title: { contains: '&' } },
        { rawTextExcerpt: { contains: '&' } },
      ],
    },
    select: { id: true, title: true, rawTextExcerpt: true },
  });
  console.log(`Loaded ${shows.length} Show rows with '&' in text fields`);
  let showUpdates = 0;
  for (const s of shows) {
    const patch: any = {};
    if (s.title && HAS_ENTITY.test(s.title)) {
      const d = decode(s.title);
      if (d !== s.title) patch.title = d;
    }
    if (s.rawTextExcerpt && HAS_ENTITY.test(s.rawTextExcerpt)) {
      const d = decode(s.rawTextExcerpt);
      if (d !== s.rawTextExcerpt) patch.rawTextExcerpt = d;
    }
    if (Object.keys(patch).length) {
      await prisma.show.update({ where: { id: s.id }, data: patch });
      showUpdates++;
    }
  }
  console.log(`  shows updated: ${showUpdates}`);

  // Festivals (name + description)
  const fests = await prisma.festival.findMany({
    where: { OR: [{ name: { contains: '&' } }, { description: { contains: '&' } }] },
    select: { id: true, name: true, description: true, aliases: true },
  });
  console.log(`\nLoaded ${fests.length} Festival rows with '&' in text fields`);
  let festUpdates = 0;
  for (const f of fests) {
    const patch: any = {};
    if (f.name && HAS_ENTITY.test(f.name)) {
      const d = decode(f.name);
      if (d !== f.name) patch.name = d;
    }
    if (f.description && HAS_ENTITY.test(f.description)) {
      const d = decode(f.description);
      if (d !== f.description) patch.description = d;
    }
    // decode aliases too
    const newAliases = f.aliases.map(decode);
    if (newAliases.some((a, i) => a !== f.aliases[i])) patch.aliases = newAliases;
    if (Object.keys(patch).length) {
      await prisma.festival.update({ where: { id: f.id }, data: patch });
      festUpdates++;
    }
  }
  console.log(`  festivals updated: ${festUpdates}`);

  // Artists too -- canonicalName + aliases
  const artists = await prisma.artist.findMany({
    where: { OR: [{ canonicalName: { contains: '&' } }] },
    select: { id: true, canonicalName: true, aliases: true },
  });
  console.log(`\nLoaded ${artists.length} Artist rows with '&' in canonicalName`);
  let artistUpdates = 0;
  for (const a of artists) {
    const patch: any = {};
    if (HAS_ENTITY.test(a.canonicalName)) {
      const d = decode(a.canonicalName);
      if (d !== a.canonicalName) patch.canonicalName = d;
    }
    const newAliases = a.aliases.map(decode);
    if (newAliases.some((x, i) => x !== a.aliases[i])) patch.aliases = newAliases;
    if (Object.keys(patch).length) {
      await prisma.artist.update({ where: { id: a.id }, data: patch });
      artistUpdates++;
    }
  }
  console.log(`  artists updated: ${artistUpdates}`);

  console.log('\nRefreshing search_index...');
  await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
