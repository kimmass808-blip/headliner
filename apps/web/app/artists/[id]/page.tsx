/**
 * Headliner — Artist 상세 페이지.
 *
 * 아티스트 1명에 연결된 Show 목록을 다가오는 / 지난 공연으로 분리해서 노출.
 * 라인업으로 들어온 child Show도 festival 컨텍스트와 함께 보여준다.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { BrandHeader } from '../../../components/BrandHeader';

export const dynamic = 'force-dynamic';

function formatDate(d: Date | null): string {
  if (!d) return '날짜 미정';
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      shows: {
        where: { duplicateOfShowId: null },
        orderBy: [{ date: 'asc' }],
        include: {
          venue: { select: { id: true, name: true, region: true } },
          festival: { select: { id: true, name: true } },
          setlist: { select: { id: true } },
        },
      },
    },
  });

  if (!artist) notFound();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const upcoming = artist.shows.filter(
    (s) => s.date && new Date(s.date) >= startOfToday,
  );
  const past = artist.shows
    .filter((s) => !s.date || new Date(s.date) < startOfToday)
    .sort((a, b) => {
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return bt - at;
    });

  return (
    <>
      <BrandHeader />

      <main className="container mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link
          href="/"
          className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-accent"
        >
          ← Search
        </Link>

        <article className="mt-8">
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
            <div className="aspect-square h-32 w-32 shrink-0 overflow-hidden rounded-full bg-neutral-100 sm:h-40 sm:w-40">
              {artist.imageUrl || artist.spotifyImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.imageUrl ?? artist.spotifyImageUrl ?? ''}
                  alt={artist.canonicalName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-neutral-400">
                  No photo
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-accent">
                Artist
              </p>
              <h2 className="mt-2 text-4xl font-bold leading-tight tracking-tightest text-neutral-900 md:text-6xl">
                {artist.canonicalName}
              </h2>
              {artist.aliases.length > 0 ? (
                <p className="mt-3 text-sm text-neutral-500">
                  {artist.aliases.join(' · ')}
                </p>
              ) : null}
              {artist.igHandle ? (
                <a
                  href={`https://www.instagram.com/${artist.igHandle}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm text-accent hover:text-accent-ink"
                >
                  @{artist.igHandle} →
                </a>
              ) : null}
            </div>
          </div>

          <section className="mt-16 border-t border-neutral-200 pt-10">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
              다가오는 공연 · {upcoming.length}
            </p>
            {upcoming.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-400">예정된 공연이 없습니다.</p>
            ) : (
              <ul className="mt-6 divide-y divide-neutral-100">
                {upcoming.map((show) => (
                  <li key={show.id} className="py-4">
                    <Link href={`/shows/${show.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-base font-medium text-neutral-900 group-hover:text-accent">
                          {show.festival ? show.festival.name : show.title ?? '공연'}
                          {show.stage ? (
                            <span className="ml-2 text-xs uppercase tracking-wider text-neutral-400">
                              {show.stage}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-neutral-500">
                          {formatDate(show.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {show.venue?.name ?? '장소 미정'}
                        {show.venue?.region ? (
                          <span className="text-neutral-400"> · {show.venue.region}</span>
                        ) : null}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-16 border-t border-neutral-200 pt-10">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
              지난 공연 · {past.length}
            </p>
            {past.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-400">아카이브된 공연이 없습니다.</p>
            ) : (
              <ul className="mt-6 divide-y divide-neutral-100">
                {past.map((show) => (
                  <li key={show.id} className="py-4">
                    <Link href={`/shows/${show.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-base text-neutral-900 group-hover:text-accent">
                          {show.festival ? show.festival.name : show.title ?? '공연'}
                          {show.stage ? (
                            <span className="ml-2 text-xs uppercase tracking-wider text-neutral-400">
                              {show.stage}
                            </span>
                          ) : null}
                          {show.setlist ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                              Setlist
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-neutral-500">
                          {formatDate(show.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {show.venue?.name ?? '장소 미정'}
                        {show.venue?.region ? (
                          <span className="text-neutral-400"> · {show.venue.region}</span>
                        ) : null}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>
      </main>
    </>
  );
}
