/**
 * Headliner — 공개 검색 메인 페이지 (AC-7, AC-7b, AC-8).
 */

import { defaultSearchEngine } from '@mft/search';
import { prisma } from '@mft/db';
import { ShowCard } from '../components/ShowCard';
import { FestivalCard } from '../components/FestivalCard';
import { HomeHeader } from '../components/home/Header';
import { HomeHero } from '../components/home/Hero';
import { HomeSearchBar } from '../components/home/SearchBar';
import { HomeFilterChips } from '../components/home/FilterChips';
import {
  UpcomingSection,
  type UpcomingItem,
} from '../components/home/UpcomingSection';
import { formatWeekdayShort } from '../components/home/PosterCard';
import {
  ResultsBar,
  type SearchFilterType,
} from '../components/search/ResultsBar';
import { ArtistSection } from '../components/search/ArtistSection';
import { EmptyState } from '../components/search/EmptyState';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  type?: string;
}

function isValidFilter(t: string | undefined): t is SearchFilterType {
  return t === 'all' || t === 'artist' || t === 'show' || t === 'festival';
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = '', type } = await searchParams;
  const trimmed = q.trim();
  const filter: SearchFilterType = isValidFilter(type) ? type : 'all';

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
          select: {
            id: true,
            canonicalName: true,
            aliases: true,
            igHandle: true,
            imageUrl: true,
            spotifyImageUrl: true,
          },
        })
      : [],
  ]);

  const showMap = new Map(shows.map((s) => [s.id, s]));
  const festivalMap = new Map(festivals.map((f) => [f.id, f]));
  const artistMap = new Map(artists.map((a) => [a.id, a]));

  // 카드 종류별로 분리
  type ShowCardData = NonNullable<ReturnType<typeof showMap.get>>;
  type FestivalCardData = NonNullable<ReturnType<typeof festivalMap.get>>;
  type ArtistCardData = NonNullable<ReturnType<typeof artistMap.get>>;
  type PosterCardResult =
    | { kind: 'show'; key: string; data: ShowCardData; sortDate: Date | null }
    | { kind: 'festival'; key: string; data: FestivalCardData; sortDate: Date | null };

  const artistCards: { key: string; data: ArtistCardData }[] = [];
  const posterCards: PosterCardResult[] = [];

  for (const r of search.results) {
    if (r.kind === 'artist') {
      const data = artistMap.get(r.id);
      if (data) artistCards.push({ key: r.id, data });
    } else if (r.kind === 'show') {
      const data = showMap.get(r.id);
      if (data) {
        posterCards.push({
          kind: 'show',
          key: r.id,
          data,
          sortDate: data.date ? new Date(data.date) : null,
        });
      }
    } else if (r.kind === 'festival') {
      const data = festivalMap.get(r.id);
      if (data) {
        posterCards.push({
          kind: 'festival',
          key: r.id,
          data,
          sortDate: data.startDate ? new Date(data.startDate) : null,
        });
      }
    }
  }

  // upcoming / past 분리 (오늘 기준)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const upcomingCards = posterCards.filter(
    (c) => c.sortDate && c.sortDate >= startOfToday,
  );
  const pastCards = posterCards.filter(
    (c) => !c.sortDate || c.sortDate < startOfToday,
  );

  // 카운트는 필터 적용 전 전체값
  const totalShows = posterCards.filter((c) => c.kind === 'show').length;
  const totalFestivals = posterCards.filter((c) => c.kind === 'festival').length;
  const totals = {
    all: artistCards.length + totalShows + totalFestivals,
    artist: artistCards.length,
    show: totalShows,
    festival: totalFestivals,
  };

  // 필터 적용
  const visibleArtists = filter === 'all' || filter === 'artist' ? artistCards : [];
  const filterPoster = (cards: PosterCardResult[]) => {
    if (filter === 'artist') return [];
    if (filter === 'show') return cards.filter((c) => c.kind === 'show');
    if (filter === 'festival') return cards.filter((c) => c.kind === 'festival');
    return cards;
  };
  const visibleUpcoming = filterPoster(upcomingCards);
  const visiblePast = filterPoster(pastCards);

  const hasAnyResults =
    visibleArtists.length + visibleUpcoming.length + visiblePast.length > 0;

  function renderPosterCard(c: PosterCardResult) {
    if (c.kind === 'show') return <ShowCard key={c.key} show={c.data} />;
    return <FestivalCard key={c.key} festival={c.data} />;
  }

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />

      <section className="mx-auto max-w-[1400px] px-6 pt-10 sm:px-10 sm:pt-12">
        <HomeSearchBar initialQuery={trimmed} />
      </section>

      <main className="pb-24">
        {hasAnyResults ? (
          <>
            <ResultsBar query={trimmed} filter={filter} totals={totals} />

            <ArtistSection
              artists={visibleArtists.map((a) => ({
                id: a.data.id,
                name: a.data.canonicalName,
                aliasText: a.data.aliases.length > 0 ? a.data.aliases.join(' · ') : null,
                imageUrl: a.data.imageUrl ?? a.data.spotifyImageUrl ?? null,
              }))}
            />

            {visibleUpcoming.length > 0 ? (
              <section className="mx-auto mt-16 max-w-[1400px] px-6 sm:mt-20 sm:px-10">
                <div className="hairline mb-10 flex items-end justify-between pb-6">
                  <div>
                    <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
                      UPCOMING / {new Date().getFullYear()}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
                        다가오는 공연
                      </h2>
                      <span className="text-[14px] tabular-nums text-paper/40">
                        {visibleUpcoming.length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleUpcoming.map(renderPosterCard)}
                </div>
              </section>
            ) : null}

            {visiblePast.length > 0 ? (
              <section className="mx-auto mt-16 max-w-[1400px] px-6 sm:mt-20 sm:px-10">
                <div className="hairline mb-10 flex items-end justify-between pb-6">
                  <div>
                    <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
                      ARCHIVE
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
                        지난 공연
                      </h2>
                      <span className="text-[14px] tabular-nums text-paper/40">
                        {visiblePast.length}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                  {visiblePast.map(renderPosterCard)}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState query={trimmed} />
        )}
      </main>
    </div>
  );
}
