/**
 * Headliner — 공개 검색 메인 페이지 (AC-7, AC-7b, AC-8).
 */

import Link from 'next/link';
import { defaultSearchEngine } from '@mft/search';
import { prisma } from '@mft/db';
import { ShowCard } from '../components/ShowCard';
import { FestivalCard } from '../components/FestivalCard';
import { ArtistResultCard } from '../components/ArtistResultCard';
import { HomeHeader } from '../components/home/Header';
import { HomeHero } from '../components/home/Hero';
import { HomeSearchBar } from '../components/home/SearchBar';
import { HomeFilterChips } from '../components/home/FilterChips';
import {
  UpcomingSection,
  type UpcomingItem,
} from '../components/home/UpcomingSection';
import { formatWeekdayShort } from '../components/home/PosterCard';

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
          venue: { select: { id: true, name: true, region: true } },
          artists: { select: { id: true, canonicalName: true } },
          festival: { select: { id: true, name: true } },
        },
      }),
    ]);

    // 페스티벌 + 단독공연을 PosterCard 형식으로 통일 → 날짜순 인터리브 → 상위 8건
    const festivalItems: UpcomingItem[] = upcomingFestivals
      .filter((f) => f.startDate)
      .map((f) => {
        const start = new Date(f.startDate!);
        const end = f.endDate ? new Date(f.endDate) : null;
        const isMultiDay = end && end.getTime() !== start.getTime();
        const dayLabel = isMultiDay
          ? (() => {
              const diff = Math.round((end!.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return `${diff} DAYS`;
            })()
          : formatWeekdayShort(start);
        return {
          key: `f:${f.id}`,
          href: `/festivals/${f.id}`,
          type: 'FESTIVAL' as const,
          imageUrl: f.posterImageUrl,
          primaryName: f.name,
          secondaryTitle: null,
          city: null,
          venueName: f.locationText ?? null,
          date: start,
          dayLabel,
        };
      });

    const showItems: UpcomingItem[] = upcomingShows
      .filter((s) => s.date)
      .map((s) => {
        const d = new Date(s.date!);
        const primaryName =
          s.artists[0]?.canonicalName ?? s.title ?? '공연';
        const secondaryTitle =
          s.artists.length > 0 && s.title ? s.title : null;
        return {
          key: `s:${s.id}`,
          href: `/shows/${s.id}`,
          type: 'SHOW' as const,
          imageUrl: s.imageUrl,
          primaryName,
          secondaryTitle,
          city: s.venue?.region ?? null,
          venueName: s.venue?.name ?? null,
          date: d,
          dayLabel: formatWeekdayShort(d),
        };
      });

    const items: UpcomingItem[] = [...festivalItems, ...showItems]
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
      .slice(0, 8);

    return (
      <div className="min-h-screen bg-ink-900 font-sans text-paper">
        <HomeHeader />
        <main>
          <section className="mx-auto max-w-[1400px] px-6 pb-12 pt-10 sm:px-10 sm:pt-14">
            <HomeHero />
            <div className="mt-10 sm:mt-12">
              <HomeSearchBar />
              <HomeFilterChips />
            </div>
          </section>
          <UpcomingSection items={items} />
        </main>
      </div>
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
  type CardResult =
    | { kind: 'show'; key: string; data: NonNullable<ReturnType<typeof showMap.get>> }
    | { kind: 'festival'; key: string; data: NonNullable<ReturnType<typeof festivalMap.get>> }
    | { kind: 'artist'; key: string; data: NonNullable<ReturnType<typeof artistMap.get>> };

  const cardResults: CardResult[] = search.results.flatMap<CardResult>((r) => {
    if (r.kind === 'show') {
      const data = showMap.get(r.id);
      return data ? [{ kind: 'show', key: r.id, data }] : [];
    }
    if (r.kind === 'festival') {
      const data = festivalMap.get(r.id);
      return data ? [{ kind: 'festival', key: r.id, data }] : [];
    }
    const data = artistMap.get(r.id);
    return data ? [{ kind: 'artist', key: r.id, data }] : [];
  });

  const artistCards = cardResults.filter((c) => c.kind === 'artist');
  const posterCards = cardResults.filter((c) => c.kind !== 'artist');

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-[1400px] px-6 pb-24 pt-10 sm:px-10 sm:pt-14">
        <HomeSearchBar initialQuery={trimmed} />
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.3em] text-paper/45">
          {contextLabel}
        </p>

        {artistCards.length > 0 ? (
          <section className="mt-12">
            {artistCards.map((c) => (
              <ArtistResultCard key={c.key} artist={c.data} />
            ))}
          </section>
        ) : null}

        {posterCards.length > 0 ? (
          <section className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {posterCards.map((c) => {
              if (c.kind === 'show') {
                return <ShowCard key={c.key} show={c.data} />;
              }
              return <FestivalCard key={c.key} festival={c.data} />;
            })}
          </section>
        ) : null}

        {cardResults.length === 0 ? (
          <p className="py-20 text-center text-sm text-paper/40">
            검색 결과가 없습니다.
          </p>
        ) : null}
      </main>
    </div>
  );
}
