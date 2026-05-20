/**
 * Headliner — Festival 상세 페이지 (AC-10).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { BrandHeader } from '../../../components/BrandHeader';

export const dynamic = 'force-dynamic';

export default async function FestivalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const festival = await prisma.festival.findUnique({
    where: { id },
    include: {
      venue: true,
      shows: {
        include: {
          artists: true,
          setlist: { select: { id: true } },
        },
        orderBy: [{ date: 'asc' }, { stage: 'asc' }, { setOrder: 'asc' }],
      },
    },
  });

  if (!festival) notFound();

  const dayMap = new Map<string, Map<string, typeof festival.shows>>();
  for (const show of festival.shows) {
    const dayKey = show.date ? new Date(show.date).toISOString().slice(0, 10) : 'unknown';
    const stageKey = show.stage ?? '(스테이지 미정)';
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
    const stages = dayMap.get(dayKey)!;
    if (!stages.has(stageKey)) stages.set(stageKey, []);
    stages.get(stageKey)!.push(show);
  }
  const days = Array.from(dayMap.keys()).sort();

  const dateRange = (() => {
    if (festival.startDate && festival.endDate) {
      const s = new Date(festival.startDate);
      const e = new Date(festival.endDate);
      return `${s.toLocaleDateString('ko-KR')} – ${e.toLocaleDateString('ko-KR')}`;
    }
    if (festival.startDate) {
      return new Date(festival.startDate).toLocaleDateString('ko-KR');
    }
    return '기간 미정';
  })();

  return (
    <>
      <BrandHeader />

      <main className="container mx-auto max-w-5xl px-6 py-10 md:py-16">
        <Link
          href="/"
          className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-accent"
        >
          ← Search
        </Link>

        <article className="mt-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.5fr]">
            <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100">
              {festival.posterImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={festival.posterImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white">
                  <span className="text-xs uppercase tracking-widest">Festival</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-widest text-accent">
                Festival
              </p>
              <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tightest text-neutral-900 md:text-6xl">
                {festival.name}
              </h2>
              <p className="mt-4 text-base text-neutral-500">{dateRange}</p>
              {festival.locationText ?? festival.venue?.name ? (
                <p className="text-base text-neutral-500">
                  {festival.locationText ?? festival.venue?.name}
                </p>
              ) : null}
              <div className="mt-6 flex gap-6 text-sm">
                {festival.officialUrl ? (
                  <a
                    href={festival.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-ink"
                  >
                    공식 →
                  </a>
                ) : null}
                {festival.ticketUrl ? (
                  <a
                    href={festival.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-ink"
                  >
                    예매 →
                  </a>
                ) : null}
              </div>
              {festival.description ? (
                <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                  {festival.description}
                </p>
              ) : null}
            </div>
          </div>

          <section className="mt-16 border-t border-neutral-200 pt-10">
            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
              Lineup
            </p>

            {days.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-400">라인업 미등록</p>
            ) : (
              <div className="mt-8 space-y-12">
                {days.map((dayKey) => {
                  const stages = dayMap.get(dayKey)!;
                  const dayLabel =
                    dayKey === 'unknown'
                      ? '(날짜 미정)'
                      : new Date(dayKey).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        });
                  return (
                    <div key={dayKey}>
                      <h3 className="text-xl font-bold tracking-tightest text-neutral-900">
                        {dayLabel}
                      </h3>
                      <div className="mt-4 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from(stages.entries()).map(([stage, shows]) => (
                          <div key={stage}>
                            <p className="text-[11px] uppercase tracking-widest text-neutral-400">
                              {stage}
                            </p>
                            <ul className="mt-2 space-y-2">
                              {shows.map((show) => (
                                <li
                                  key={show.id}
                                  className="border-b border-neutral-100 pb-2"
                                >
                                  <Link
                                    href={`/shows/${show.id}`}
                                    className="text-base text-neutral-900 hover:text-accent"
                                  >
                                    {show.startTime ? (
                                      <span className="font-mono text-sm text-neutral-400">
                                        {show.startTime}{' '}
                                      </span>
                                    ) : null}
                                    {show.artists.map((a) => a.canonicalName).join(', ')}
                                    {show.setlist ? (
                                      <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                                        Setlist
                                      </span>
                                    ) : null}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </article>
      </main>
    </>
  );
}
