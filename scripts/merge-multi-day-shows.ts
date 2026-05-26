/**
 * v6 one-shot: consolidate multi-day same-show pairs/triples into
 * single Show + N sessions.
 *
 * Cluster key (must all match):
 *   - exact same artist set (sorted ids joined)
 *   - same title (trimmed, case-folded; non-empty required)
 *   - same venueId (non-null required)
 *   - same year of firstSessionDate
 *   - festivalId IS NULL (festival-linked shows stay split — Day 1 ≠ Day 2 setlist)
 *
 * Within a key group, adjacency: build clusters where consecutive
 * firstSessionDate diff ≤ 7 days. Each cluster of ≥ 2 Shows is merged
 * into the lowest-id winner; loser sessions are reparented; artist
 * links unioned; loser Show rows deleted; ShowMergeLog rows written.
 *
 * Usage:
 *   pnpm tsx scripts/merge-multi-day-shows.ts --dry-run
 *   pnpm tsx scripts/merge-multi-day-shows.ts --apply
 *   pnpm tsx scripts/merge-multi-day-shows.ts --apply --artist=<artistId>   # scope to one artist
 */

import { PrismaClient } from '@prisma/client';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) { console.error('DIRECT_URL not set'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY; // default safe
const artistScope = process.argv.find((a) => a.startsWith('--artist='))?.split('=')[1] ?? null;
const MAX_GAP_DAYS = 7;

type ShowRow = {
  id: string;
  title: string | null;
  venueId: string | null;
  festivalId: string | null;
  duplicateOfShowId: string | null;
  firstSessionDate: Date | null;
  lastSessionDate: Date | null;
  imageUrl: string | null;
  artistIds: string[];           // sorted
};

function normalizedTitle(t: string | null): string | null {
  if (!t) return null;
  const s = t.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  return s.length === 0 ? null : s;
}

function groupKey(s: ShowRow): string | null {
  const title = normalizedTitle(s.title);
  if (!title) return null;
  if (!s.venueId) return null;
  if (s.festivalId) return null;
  if (s.duplicateOfShowId) return null;
  if (s.artistIds.length === 0) return null;
  if (!s.firstSessionDate) return null;
  const year = new Date(s.firstSessionDate).getUTCFullYear();
  return [s.artistIds.join(','), title, s.venueId, year].join('|');
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.round(ms / 86_400_000);
}

async function loadShows(): Promise<ShowRow[]> {
  const rows = await prisma.show.findMany({
    where: {
      firstSessionDate: { not: null },
      title: { not: null },
      venueId: { not: null },
      festivalId: null,
      duplicateOfShowId: null,
      ...(artistScope ? { artists: { some: { id: artistScope } } } : {}),
    },
    select: {
      id: true, title: true, venueId: true, festivalId: true,
      duplicateOfShowId: true, firstSessionDate: true, lastSessionDate: true,
      imageUrl: true,
      artists: { select: { id: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id, title: r.title, venueId: r.venueId, festivalId: r.festivalId,
    duplicateOfShowId: r.duplicateOfShowId,
    firstSessionDate: r.firstSessionDate, lastSessionDate: r.lastSessionDate,
    imageUrl: r.imageUrl,
    artistIds: r.artists.map((a) => a.id).sort(),
  }));
}

async function main() {
  console.log(`merge-multi-day-shows ${DRY ? '(dry-run)' : '(APPLY)'} ${artistScope ? `artist=${artistScope}` : ''}`);
  const shows = await loadShows();
  console.log(`candidate shows: ${shows.length}`);

  // Group
  const groups = new Map<string, ShowRow[]>();
  for (const s of shows) {
    const k = groupKey(s);
    if (!k) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }

  // Build adjacency clusters
  type Cluster = { winner: ShowRow; losers: ShowRow[] };
  const clusters: Cluster[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.firstSessionDate!.getTime() - b.firstSessionDate!.getTime());
    let current: ShowRow[] = [list[0]!];
    for (let i = 1; i < list.length; i++) {
      const prev = current[current.length - 1]!;
      const cur = list[i]!;
      if (daysBetween(prev.lastSessionDate ?? prev.firstSessionDate!, cur.firstSessionDate!) <= MAX_GAP_DAYS) {
        current.push(cur);
      } else {
        if (current.length >= 2) clusters.push({ winner: current[0]!, losers: current.slice(1) });
        current = [cur];
      }
    }
    if (current.length >= 2) clusters.push({ winner: current[0]!, losers: current.slice(1) });
  }

  console.log(`merge clusters: ${clusters.length} (would merge ${clusters.reduce((n, c) => n + c.losers.length, 0)} loser show rows)`);
  for (const c of clusters) {
    const allIds = [c.winner.id, ...c.losers.map((l) => l.id)];
    const allDates = [c.winner.firstSessionDate!, ...c.losers.map((l) => l.firstSessionDate!)]
      .map((d) => d.toISOString().slice(0, 10)).sort();
    console.log(`  [${c.winner.title}] ids=${allIds.join(',')}  dates=${allDates.join(',')}`);
  }

  if (DRY) {
    console.log('\ndry-run; pass --apply to execute.');
    await prisma.$disconnect();
    return;
  }

  // Apply
  let mergedShows = 0;
  let movedSessions = 0;
  let movedArtists = 0;

  for (const c of clusters) {
    const winnerId = c.winner.id;
    for (const loser of c.losers) {
      await prisma.$transaction(async (tx) => {
        // 1) Snapshot loser for audit
        const snapshot = await tx.show.findUnique({
          where: { id: loser.id },
          include: { sessions: true, artists: { select: { id: true } } },
        });

        // 2) Re-parent sessions. If a session date already exists on winner,
        //    keep the winner's row and delete the loser's (newest data wins
        //    only via re-ingest; here we're consolidating, not patching).
        const winnerDates = await tx.showSession.findMany({
          where: { showId: winnerId }, select: { date: true },
        });
        const have = new Set(winnerDates.map((d) => d.date.toISOString().slice(0, 10)));
        for (const s of snapshot!.sessions) {
          const key = s.date.toISOString().slice(0, 10);
          if (have.has(key)) {
            await tx.showSession.delete({ where: { id: s.id } });
          } else {
            await tx.showSession.update({ where: { id: s.id }, data: { showId: winnerId } });
            movedSessions++;
          }
        }

        // 3) Union artist links (loser's artistSet == winner's by group key,
        //    so this is a no-op in practice — included defensively).
        for (const a of snapshot!.artists) {
          const r = await tx.$executeRawUnsafe(
            `INSERT INTO "_ShowArtists" ("A","B") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            a.id, winnerId,
          );
          if (r > 0) movedArtists++;
        }

        // 4) Setlist: only move if winner has none and loser has one
        const winnerSetlist = await tx.setlist.findUnique({ where: { showId: winnerId } });
        const loserSetlist  = await tx.setlist.findUnique({ where: { showId: loser.id } });
        if (loserSetlist && !winnerSetlist) {
          await tx.setlist.update({ where: { id: loserSetlist.id }, data: { showId: winnerId } });
        } else if (loserSetlist && winnerSetlist) {
          // Leave loser setlist; will be deleted by cascade when Show row is removed
        }

        // 5) imageUrl: backfill winner if missing
        if (!c.winner.imageUrl && loser.imageUrl) {
          await tx.show.update({ where: { id: winnerId }, data: { imageUrl: loser.imageUrl } });
        }

        // 6) Audit
        await tx.showMergeLog.create({
          data: {
            winnerId,
            loserData: JSON.parse(JSON.stringify(snapshot)),
            mergedBy: 'operator',
            reason: 'multi-day-merge (Phase 4)',
          },
        });

        // 7) Delete loser Show (cascade removes its remaining sessions/setlist)
        await tx.show.delete({ where: { id: loser.id } });
        mergedShows++;
      }, { timeout: 30_000 });
    }

    // 8) Recompute winner's date range
    const sessions = await prisma.showSession.findMany({
      where: { showId: winnerId }, orderBy: { date: 'asc' },
    });
    if (sessions.length > 0) {
      await prisma.show.update({
        where: { id: winnerId },
        data: {
          firstSessionDate: sessions[0]!.date,
          lastSessionDate: sessions[sessions.length - 1]!.date,
          // Mirror legacy fields to firstSession until Phase 6
          date: sessions[0]!.date,
          startTime: sessions[0]!.startTime,
          ticketUrl: sessions[0]!.ticketUrl,
        },
      });
    }
  }

  // Refresh search_index
  if (mergedShows > 0) {
    console.log('Refreshing search_index...');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY search_index');
  }

  console.log(`\nmerged: ${mergedShows} loser shows  |  sessions moved: ${movedSessions}  |  artist links inserted: ${movedArtists}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
