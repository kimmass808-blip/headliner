/**
 * Headliner — Show 상세 페이지 (AC-9).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { formatMissingFieldsBadge, type MissingFieldKey } from '@mft/shared';
import { BrandHeader } from '../../../components/BrandHeader';

export const dynamic = 'force-dynamic';

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      venue: true,
      artists: true,
      festival: { select: { id: true, name: true, startDate: true } },
      setlist: { include: { songs: { orderBy: { order: 'asc' } } } },
    },
  });

  if (!show) notFound();

  const badge = formatMissingFieldsBadge(show.missingFields as MissingFieldKey[]);
  const dateStr = show.date
    ? new Date(show.date).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    : null;
  const artists = show.artists.map((a) => a.canonicalName).join(', ');

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
          {show.imageUrl ? (
            <div className="aspect-[3/4] max-h-[70vh] w-full overflow-hidden bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={show.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div className="mt-8">
            {show.festival ? (
              <Link
                href={`/festivals/${show.festival.id}`}
                className="text-[11px] uppercase tracking-widest text-accent hover:text-accent-ink"
              >
                {show.festival.name}
                {show.stage ? ` · ${show.stage}` : ''}
              </Link>
            ) : (
              <p className="text-[11px] uppercase tracking-widest text-neutral-400">
                Live
              </p>
            )}
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tightest text-neutral-900 md:text-5xl">
              {artists || show.title || '제목 미정'}
            </h2>
            {show.title && artists ? (
              <p className="mt-2 text-base text-neutral-500">{show.title}</p>
            ) : null}
            {badge ? (
              <p className="mt-3 inline-block bg-neutral-100 px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
                {badge}
              </p>
            ) : null}
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-y-6 border-t border-neutral-200 pt-8 md:grid-cols-[120px_1fr] md:gap-x-8">
            <dt className="text-[11px] uppercase tracking-widest text-neutral-400">
              Date
            </dt>
            <dd className="text-base text-neutral-900">
              {dateStr ?? <span className="text-neutral-400">미정</span>}
              {show.startTime ? (
                <span className="text-neutral-500"> · {show.startTime}</span>
              ) : null}
            </dd>

            <dt className="text-[11px] uppercase tracking-widest text-neutral-400">
              Venue
            </dt>
            <dd className="text-base text-neutral-900">
              {show.venue?.name ?? <span className="text-neutral-400">미정</span>}
              {show.venue?.region ? (
                <span className="text-neutral-500"> · {show.venue.region}</span>
              ) : null}
            </dd>

            <dt className="text-[11px] uppercase tracking-widest text-neutral-400">
              Artist
            </dt>
            <dd className="text-base text-neutral-900">
              {show.artists.length > 0 ? (
                artists
              ) : (
                <span className="text-neutral-400">미정</span>
              )}
            </dd>

            {show.ticketUrl ? (
              <>
                <dt className="text-[11px] uppercase tracking-widest text-neutral-400">
                  Ticket
                </dt>
                <dd>
                  <a
                    href={show.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-accent hover:text-accent-ink"
                  >
                    예매 →
                  </a>
                </dd>
              </>
            ) : null}

            <dt className="text-[11px] uppercase tracking-widest text-neutral-400">
              Source
            </dt>
            <dd>
              <a
                href={show.originalPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-accent hover:text-accent-ink"
              >
                인스타그램 원문 →
              </a>
            </dd>
          </dl>

          {show.setlist ? (
            <section className="mt-16 border-t border-neutral-200 pt-10">
              <p className="text-[11px] uppercase tracking-widest text-neutral-400">
                Setlist
              </p>
              <ol className="mt-6 space-y-2">
                {show.setlist.songs.map((song) => (
                  <li
                    key={song.id}
                    className="flex gap-4 border-b border-neutral-100 py-2 text-base"
                  >
                    <span className="w-8 text-right font-mono text-sm text-neutral-400">
                      {String(song.order).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <span className="text-neutral-900">{song.title}</span>
                      {song.isEncore ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                          Encore
                        </span>
                      ) : null}
                      {song.coverOf ? (
                        <span className="ml-2 text-xs text-neutral-400">
                          cover of {song.coverOf}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              {show.setlist.sourceNotes ? (
                <p className="mt-4 text-xs text-neutral-400">
                  출처: {show.setlist.sourceNotes}
                </p>
              ) : null}
            </section>
          ) : (
            <p className="mt-16 border-t border-neutral-200 pt-10 text-sm text-neutral-400">
              셋리스트 미등록
            </p>
          )}
        </article>
      </main>
    </>
  );
}
