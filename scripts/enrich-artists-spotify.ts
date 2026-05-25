/**
 * Enrich linked artists with full Spotify catalog data.
 *
 * For each Artist with spotifyId set (and either lastEnrichedAt null or
 * --force):
 *   - GET /artists/{id}          -> popularity, genres, followers, images
 *   - GET /artists/{id}/top-tracks?market=KR -> top 10 tracks
 *   - Upload artist image to Supabase Storage (webp <=1200px)
 *   - Upload each unique album image (dedupe by URL via pipeImage's content
 *     hash)
 *   - Upsert Track rows by spotifyId
 *   - Update Artist row + lastEnrichedAt
 *
 * Re-runnable: existing Tracks for the artist are wiped each pass, then
 * re-inserted with current top-tracks data.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-artists-spotify.ts             # only artists never enriched
 *   pnpm tsx scripts/enrich-artists-spotify.ts --force     # refresh every linked artist
 *   pnpm tsx scripts/enrich-artists-spotify.ts --dry-run   # no writes, no uploads
 */

import { PrismaClient } from '@prisma/client';
import { getArtist, getArtistAlbums, getAlbum, pickBestImage } from './lib/spotify';
import { pipeImage } from './lib/posters';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

function releaseDateToDate(s: string | null): Date | null {
  if (!s) return null;
  // Spotify returns YYYY, YYYY-MM, or YYYY-MM-DD per release_date_precision.
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  try {
    return new Date(Date.UTC(y, mo - 1, d));
  } catch {
    return null;
  }
}

type RunStats = {
  processed: number;
  updated: number;
  tracksInserted: number;
  artistImagesUploaded: number;
  albumImagesUploaded: number;
  imageBytesIn: number;
  imageBytesOut: number;
  errors: string[];
};

async function maybeUploadImage(url: string | null, stats: RunStats, kind: 'artist' | 'album'): Promise<string | null> {
  if (!url) return null;
  if (DRY) return null;
  try {
    const { publicUrl, normalized } = await pipeImage(url);
    if (kind === 'artist') stats.artistImagesUploaded++;
    else stats.albumImagesUploaded++;
    stats.imageBytesIn += normalized.origBytes;
    stats.imageBytesOut += normalized.buffer.length;
    return publicUrl;
  } catch (e) {
    stats.errors.push(`image upload (${kind}) failed for ${url}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    return null;
  }
}

const MAX_ALBUMS_PER_ARTIST = 6;     // keep top N after dedup
const SPOTIFY_ALBUM_LIST_LIMIT = 10; // Spotify caps new apps at 10 per page
const MAX_TRACKS_PER_ARTIST = 40;    // cap regardless of album count

async function enrichOne(artist: { id: string; canonicalName: string; spotifyId: string }, stats: RunStats) {
  stats.processed++;
  console.log(`  enriching ${artist.canonicalName} (${artist.spotifyId})...`);
  try {
    // Artist details + album list in parallel.
    const [details, albumList] = await Promise.all([
      getArtist(artist.spotifyId),
      getArtistAlbums(artist.spotifyId, { market: 'KR', limit: SPOTIFY_ALBUM_LIST_LIMIT }),
    ]);

    const spotifyImage = pickBestImage(details.images);
    const imageUrl = await maybeUploadImage(spotifyImage, stats, 'artist');

    const externalLinks: Record<string, string> = {
      spotify: details.external_urls.spotify,
    };

    if (!DRY) {
      await prisma.artist.update({
        where: { id: artist.id },
        data: {
          spotifyImageUrl: spotifyImage ?? undefined,
          imageUrl: imageUrl ?? undefined,
          genres: details.genres ?? [],
          popularity: details.popularity ?? null,
          followerCount: details.followers?.total ?? null,
          externalLinks,
          lastEnrichedAt: new Date(),
        },
      });
      stats.updated++;
    }

    // Sort albums newest-first, dedupe by name (singles often re-released on
    // later compilations), keep top N.
    const sorted = albumList
      .slice()
      .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    const seenName = new Set<string>();
    const pick: typeof sorted = [];
    for (const a of sorted) {
      const key = a.name.toLowerCase().trim();
      if (seenName.has(key)) continue;
      seenName.add(key);
      pick.push(a);
      if (pick.length >= MAX_ALBUMS_PER_ARTIST) break;
    }

    // Wipe existing tracks for this artist (rebuild approach).
    if (!DRY) {
      await prisma.track.deleteMany({ where: { artistId: artist.id } });
    }

    const albumImageCache = new Map<string, string | null>();
    const seenTrackSpotifyId = new Set<string>();
    let trackCountForArtist = 0;

    for (const summary of pick) {
      if (trackCountForArtist >= MAX_TRACKS_PER_ARTIST) break;
      let full;
      try {
        full = await getAlbum(summary.id, 'KR');
      } catch (e) {
        stats.errors.push(`${artist.canonicalName} album "${summary.name}": ${(e as Error).message.split('\n')[0]}`);
        continue;
      }
      const rawAlbumImg = pickBestImage(full.images ?? summary.images);
      let albumImageUrl: string | null = null;
      if (rawAlbumImg) {
        if (albumImageCache.has(rawAlbumImg)) {
          albumImageUrl = albumImageCache.get(rawAlbumImg)!;
        } else {
          albumImageUrl = await maybeUploadImage(rawAlbumImg, stats, 'album');
          albumImageCache.set(rawAlbumImg, albumImageUrl);
        }
      }
      for (const t of full.tracks.items) {
        if (trackCountForArtist >= MAX_TRACKS_PER_ARTIST) break;
        if (seenTrackSpotifyId.has(t.id)) continue;
        seenTrackSpotifyId.add(t.id);
        if (DRY) {
          trackCountForArtist++;
          continue;
        }
        await prisma.track.create({
          data: {
            title: t.name,
            artistId: artist.id,
            durationMs: t.duration_ms ?? null,
            releaseDate: releaseDateToDate(full.release_date ?? summary.release_date),
            isrc: t.external_ids?.isrc ?? null,
            spotifyId: t.id,
            previewUrl: t.preview_url ?? null,    // null for most new apps (Spotify Nov 2024 restriction)
            albumName: full.name ?? summary.name,
            albumImageRaw: rawAlbumImg ?? null,
            albumImageUrl: albumImageUrl ?? null,
            popularity: null,                     // album tracks don't carry popularity
            trackNumber: t.track_number ?? null,
          },
        });
        trackCountForArtist++;
        stats.tracksInserted++;
      }
    }
    console.log(
      `    ✓ ${artist.canonicalName}: pop=${details.popularity ?? '-'}, genres=[${details.genres?.join(', ') || '-'}], albums=${pick.length}, tracks=${trackCountForArtist}`,
    );
  } catch (e) {
    stats.errors.push(`${artist.canonicalName}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    console.error(`    ! ${artist.canonicalName}: failed -- ${(e as Error).message.split('\n')[0]}`);
  }
}

async function main() {
  console.log(`Mode: ${DRY ? 'DRY RUN' : 'WRITE'}  force=${FORCE}`);
  const where: any = { spotifyId: { not: null } };
  if (!FORCE) where.lastEnrichedAt = null;
  const targets = await prisma.artist.findMany({
    where,
    select: { id: true, canonicalName: true, spotifyId: true },
    orderBy: { firstSeenAt: 'asc' },
  });
  console.log(`Artists to enrich: ${targets.length}`);

  const stats: RunStats = {
    processed: 0,
    updated: 0,
    tracksInserted: 0,
    artistImagesUploaded: 0,
    albumImagesUploaded: 0,
    imageBytesIn: 0,
    imageBytesOut: 0,
    errors: [],
  };

  for (const a of targets) {
    if (!a.spotifyId) continue;
    await enrichOne({ id: a.id, canonicalName: a.canonicalName, spotifyId: a.spotifyId }, stats);
  }

  console.log(`\nDone.`);
  console.log(`  artists processed: ${stats.processed}`);
  console.log(`  artists updated:   ${stats.updated}`);
  console.log(`  tracks inserted:   ${stats.tracksInserted}`);
  console.log(`  artist images:     ${stats.artistImagesUploaded}`);
  console.log(`  album images:      ${stats.albumImagesUploaded}`);
  console.log(`  image bytes:       ${(stats.imageBytesIn / 1024 / 1024).toFixed(1)}MB -> ${(stats.imageBytesOut / 1024 / 1024).toFixed(1)}MB`);
  if (stats.errors.length) {
    console.log(`  errors: ${stats.errors.length}`);
    for (const e of stats.errors.slice(0, 10)) console.log(`    ${e}`);
  }
  if (DRY) console.log(`\n(dry-run: no writes)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
