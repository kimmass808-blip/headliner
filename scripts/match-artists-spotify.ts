/**
 * Match local Artist rows to Spotify catalog entries.
 *
 * For each artist not already linked (spotifyId is null), search Spotify with
 * canonicalName + aliases, score the top hits, and store all candidates in
 * SpotifyMatchCandidate. Auto-link the top candidate only when confidence is
 * high (>=0.95) and there's clear separation from the runner-up (>=0.2 gap).
 *
 * Re-runnable: existing SpotifyMatchCandidate rows for the artist are wiped
 * each pass before re-scoring.
 *
 * Usage:
 *   pnpm tsx scripts/match-artists-spotify.ts --dry-run        # candidate stash only
 *   pnpm tsx scripts/match-artists-spotify.ts                  # writes spotifyId for confident matches
 *   pnpm tsx scripts/match-artists-spotify.ts --min-shows=2    # skip 1-show artists
 */

import { PrismaClient } from '@prisma/client';
import { searchArtists, pickBestImage, type SpotifyArtist } from './lib/spotify';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const DRY = process.argv.includes('--dry-run');
const MIN_SHOWS = (() => {
  const arg = process.argv.find((a) => a.startsWith('--min-shows='));
  return arg ? Number(arg.split('=')[1]) : 0;
})();
const AUTO_LINK_THRESHOLD = 0.95;
const AUTO_LINK_GAP = 0.2;
const KOREAN_GENRE_HINTS = ['korea', 'k-indie', 'k-pop', 'k-rock', 'k-rap', 'k-rnb', 'k-folk'];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w가-힯]/g, '');
}

function scoreCandidate(
  spotifyArtist: SpotifyArtist,
  ourNames: string[],
): { score: number; reason: string } {
  const sn = normalize(spotifyArtist.name);
  const ours = ourNames.map(normalize).filter(Boolean);
  if (ours.length === 0) return { score: 0, reason: 'no-our-names' };

  // 1.0 - exact match
  if (ours.includes(sn)) return { score: 1.0, reason: 'exact' };

  // 0.95 - one is a substring of the other (and short side >= 3 chars to avoid 'we' problems)
  for (const o of ours) {
    if (o.length < 3 || sn.length < 3) continue;
    if (sn === o) return { score: 1.0, reason: 'exact' };
    if (sn.includes(o) || o.includes(sn)) {
      const shorter = Math.min(o.length, sn.length);
      const longer = Math.max(o.length, sn.length);
      const ratio = shorter / longer;
      if (ratio >= 0.7) return { score: 0.9 * ratio, reason: 'substring' };
    }
  }

  // 0.85 - Korean-genre signal
  const genres = (spotifyArtist.genres ?? []).map((g) => g.toLowerCase());
  const koreanHint = genres.some((g) => KOREAN_GENRE_HINTS.some((h) => g.includes(h)));
  if (koreanHint) {
    // partial overlap by character set
    for (const o of ours) {
      if (o.length < 2) continue;
      const overlap = [...o].filter((c) => sn.includes(c)).length;
      const ratio = overlap / Math.max(o.length, sn.length);
      if (ratio >= 0.6) return { score: 0.7 + ratio * 0.1, reason: 'korean-genre+overlap' };
    }
  }

  return { score: 0, reason: 'no-match' };
}

type ArtistRow = {
  id: string;
  canonicalName: string;
  aliases: string[];
  spotifyId: string | null;
  show_count: number;
};

async function main() {
  console.log(`Mode: ${DRY ? 'DRY RUN' : 'WRITE'}  min-shows=${MIN_SHOWS}`);

  const rows = (await prisma.$queryRawUnsafe<ArtistRow[]>(`
    SELECT a.id, a."canonicalName", a.aliases, a."spotifyId",
           (SELECT COUNT(*) FROM "_ShowArtists" sa WHERE sa."A" = a.id)::int AS show_count
    FROM "Artist" a
    WHERE a."spotifyId" IS NULL
  `)) as ArtistRow[];

  const targets = rows.filter((r) => r.show_count >= MIN_SHOWS);
  console.log(`Unlinked artists total=${rows.length}  targets (shows>=${MIN_SHOWS})=${targets.length}`);

  let searched = 0;
  let autoLinked = 0;
  let candidatesSaved = 0;
  let noHits = 0;

  for (const a of targets) {
    searched++;
    const ourNames = [a.canonicalName, ...a.aliases].filter(Boolean);
    const queries = Array.from(new Set(ourNames)).slice(0, 3);

    const allHits = new Map<string, { artist: SpotifyArtist; score: number; reason: string }>();
    for (const q of queries) {
      try {
        const hits = await searchArtists(q, 'KR', 5);
        for (const h of hits) {
          if (allHits.has(h.id)) continue;
          const s = scoreCandidate(h, ourNames);
          // Keep ALL hits, even low-score ones, so the operator can later
          // confirm matches that the heuristic missed (Romaja-only Spotify
          // listings, transliteration differences, etc.).
          allHits.set(h.id, { artist: h, score: s.score, reason: s.reason });
        }
      } catch (e) {
        console.error(`  ! search "${q}" failed:`, (e as Error).message.split('\n')[0]);
      }
    }

    if (allHits.size === 0) {
      noHits++;
      continue;
    }

    const ranked = [...allHits.values()].sort((x, y) => {
      if (Math.abs(x.score - y.score) > 0.05) return y.score - x.score;
      return (y.artist.popularity ?? 0) - (x.artist.popularity ?? 0);
    });
    const top = ranked.slice(0, 5);

    if (!DRY) {
      // wipe existing candidates for this artist
      await prisma.spotifyMatchCandidate.deleteMany({ where: { artistId: a.id } });
      for (let i = 0; i < top.length; i++) {
        const c = top[i];
        await prisma.spotifyMatchCandidate.create({
          data: {
            artistId: a.id,
            rank: i + 1,
            spotifyId: c.artist.id,
            spotifyName: c.artist.name,
            popularity: c.artist.popularity ?? null,
            genres: c.artist.genres ?? [],
            imageUrl: pickBestImage(c.artist.images),
            score: c.score,
            reason: c.reason,
          },
        });
        candidatesSaved++;
      }
    }

    const best = top[0];
    const runnerUp = top[1];
    const gap = runnerUp ? best.score - runnerUp.score : best.score;
    const confident =
      best.score >= AUTO_LINK_THRESHOLD && (top.length === 1 || gap >= AUTO_LINK_GAP);

    if (confident) {
      if (!DRY) {
        try {
          await prisma.artist.update({
            where: { id: a.id },
            data: { spotifyId: best.artist.id },
          });
          autoLinked++;
        } catch (e: any) {
          if (e?.code === 'P2002') {
            // Another Artist row already owns this Spotify ID -- our two rows
            // represent the same artist. Skip linking; log for later manual
            // merge.
            const owner = await prisma.artist.findUnique({
              where: { spotifyId: best.artist.id },
              select: { canonicalName: true, id: true },
            });
            console.log(
              `  ⚠ ${a.canonicalName} would link to ${best.artist.name} but ` +
                `${owner?.canonicalName ?? '(unknown)'} already owns that Spotify ID -- skipped`,
            );
          } else {
            throw e;
          }
        }
      } else {
        autoLinked++;
      }
      if (searched % 20 === 0 || autoLinked < 10 || DRY) {
        console.log(
          `  ✓ ${a.canonicalName} -> ${best.artist.name} (${best.reason}, score=${best.score.toFixed(2)}, pop=${best.artist.popularity})`,
        );
      }
    } else if (DRY && searched % 50 === 0) {
      console.log(`  · ${a.canonicalName} -> ${best.artist.name} (${best.reason}, score=${best.score.toFixed(2)}) [needs review]`);
    }

    if (searched % 50 === 0) {
      console.log(`  ... ${searched}/${targets.length}  linked=${autoLinked}  candidates=${candidatesSaved}  no-hits=${noHits}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  searched:           ${searched}`);
  console.log(`  auto-linked:        ${autoLinked}`);
  console.log(`  candidates stored:  ${candidatesSaved}`);
  console.log(`  no Spotify hits:    ${noHits}`);
  console.log(`  needs manual review: ${searched - autoLinked - noHits}`);

  if (DRY) {
    console.log('\n(dry-run) no spotifyId writes, no candidates persisted.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
