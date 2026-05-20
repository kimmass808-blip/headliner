/**
 * Headliner — 공개 검색 메인 페이지 (AC-7, AC-7b, AC-8).
 */

import Link from 'next/link';
import { defaultSearchEngine } from '@mft/search';
import { prisma } from '@mft/db';
import { SearchForm } from '../components/SearchForm';
import { ShowCard } from '../components/ShowCard';
import { FestivalCard } from '../components/FestivalCard';
import { ArtistResultCard } from '../components/ArtistResultCard';
import { BrandHeader } from '../components/BrandHeader';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = '' } = await searchParams;
  const trimmed = q.trim();

  if (!trimmed) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 페스티벌은 카드 1개로 묶고, festivalId가 없는 standalone Show만 ShowCard로.
    // 같은 페스티벌의 lineup child Show가 그리드를 도배하지 않도록.
    const [upcomingFestivals, upcomingShows] = await Promise.all([
      prisma.festival.findMany({
        where: {
          startDate: { gte: startOfToday },
          completeness: { gte: 1 },
        },
        orderBy: [{ startDate: 'asc' }],
        take: 8,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          locationText: true,
          posterImageUrl: true,
          completeness: true,
        },
      }),
      prisma.show.findMany({
        where: {
          date: { gte: startOfToday },
          completeness: { gte: 1 },
          duplicateOfShowId: null,
          festivalId: null,
        },
        orderBy: [{ date: 'asc' }],
        take: 8,
        select: {
          id: true,
          date: true,
          startTime: true,
          title: true,
          originalPostUrl: true,
          imageUrl: true,
          completeness: true,
          missingFields: true,
          stage: true,
          festivalId: true,
          venue: { select: { id: true, name: true } },
          artists: { select: { id: true, canonicalName: true } },
          festival: { select: { id: true, name: true } },
        },
      }),
    ]);

    // 페스티벌 + 단독공연을 날짜순으로 인터리브 후 상위 8건만 표시
    type UpcomingCard =
      | { kind: 'festival'; key: string; sortDate: Date; data: (typeof upcomingFestivals)[number] }
      | { kind: 'show'; key: string; sortDate: Date; data: (typeof upcomingShows)[number] };

    const cards: UpcomingCard[] = [
      ...upcomingFestivals
        .filter((f) => f.startDate)
        .map<UpcomingCard>((f) => ({ kind: 'festival', key: f.id, sortDate: new Date(f.startDate!), data: f })),
      ...upcomingShows
        .filter((s) => s.date)
        .map<UpcomingCard>((s) => ({ kind: 'show', key: s.id, sortDate: new Date(s.date!), data: s })),
    ]
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(0, 8);

    return (
      <>
        <BrandHeader />
        <main className="container mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-5xl font-bold leading-[1.1] tracking-tightest text-neutral-900 md:text-7xl">
            국내 인디
            <br />
            공연·페스티벌.
          </h2>
          <p className="mt-6 text-base text-neutral-500">
            전국 인디 씬의 공연과 페스티벌을 한 곳에서.
          </p>
          <SearchForm />
          <p className="mt-4 text-xs uppercase tracking-widest text-neutral-400">
            아티스트 · 공연장 · 페스티벌
          </p>

          {cards.length > 0 ? (
            <section className="mt-20">
              <p className="text-[11px] uppercase tracking-widest text-neutral-400">
                다가오는 공연
              </p>
              <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
                {cards.map((c) =>
                  c.kind === 'festival' ? (
                    <FestivalCard key={c.key} festival={c.data} />
                  ) : (
                    <ShowCard key={c.key} show={c.data} />
                  ),
                )}
              </div>
            </section>
          ) : null}
        </main>
      </>
    );
  }

  const search = await defaultSearchEngine.search(trimmed, { limit: 30 });
  const showIds = search.results.filter((r) => r.kind === 'show').map((r) => r.id);
  const festivalIds = search.results.filter((r) => r.kind === 'festival').map((r) => r.id);
  const artistIds = search.results.filter((r) => r.kind === 'artist').map((r) => r.id);

  const [shows, festivals, artists] = await Promise.all([
    showIds.length
      ? prisma.show.findMany({
          where: { id: { in: showIds } },
          select: {
            id: true,
            date: true,
            startTime: true,
            title: true,
            originalPostUrl: true,
            imageUrl: true,
            completeness: true,
            missingFields: true,
            stage: true,
            festivalId: true,
            venue: { select: { id: true, name: true } },
            artists: { select: { id: true, canonicalName: true } },
            festival: { select: { id: true, name: true } },
          },
        })
      : [],
    festivalIds.length
      ? prisma.festival.findMany({
          where: { id: { in: festivalIds } },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            locationText: true,
            posterImageUrl: true,
            completeness: true,
          },
        })
      : [],
    artistIds.length
      ? prisma.artist.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, canonicalName: true, aliases: true, igHandle: true },
        })
      : [],
  ]);

  const showMap = new Map(shows.map((s) => [s.id, s]));
  const festivalMap = new Map(festivals.map((f) => [f.id, f]));
  const artistMap = new Map(artists.map((a) => [a.id, a]));

  const contextLabel =
    search.contextMode === 'festival_mode'
      ? 'Festival'
      : search.contextMode === 'artist_mode'
      ? 'Artist'
      : `${search.results.length} 결과`;

  // 카드 종류별로 분리해서 영역화
  const cardResults = search.results.flatMap((r) => {
    if (r.kind === 'show') {
      const data = showMap.get(r.id);
      return data ? [{ kind: 'show' as const, key: r.id, data }] : [];
    }
    if (r.kind === 'festival') {
      const data = festivalMap.get(r.id);
      return data ? [{ kind: 'festival' as const, key: r.id, data }] : [];
    }
    const data = artistMap.get(r.id);
    return data ? [{ kind: 'artist' as const, key: r.id, data }] : [];
  });

  const artistCards = cardResults.filter((c) => c.kind === 'artist');
  const posterCards = cardResults.filter((c) => c.kind !== 'artist');

  return (
    <>
      <BrandHeader />
      <main className="container mx-auto max-w-5xl px-6 py-12">
        <SearchForm initialQuery={trimmed} />
        <p className="mt-4 text-[11px] uppercase tracking-widest text-neutral-400">
          {contextLabel}
        </p>

        {artistCards.length > 0 ? (
          <section className="mt-8 border-t border-neutral-200">
            {artistCards.map((c) => (
              <ArtistResultCard key={c.key} artist={c.data} />
            ))}
          </section>
        ) : null}

        {posterCards.length > 0 ? (
          <section className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {posterCards.map((c) => {
              if (c.kind === 'show') {
                return <ShowCard key={c.key} show={c.data} />;
              }
              return <FestivalCard key={c.key} festival={c.data} />;
            })}
          </section>
        ) : null}

        {cardResults.length === 0 ? (
          <p className="py-20 text-center text-neutral-400">
            검색 결과가 없습니다.
          </p>
        ) : null}
      </main>
    </>
  );
}
