/**
 * Headliner — 공개 검색 메인 페이지 (AC-7, AC-7b, AC-8).
 */

import { unstable_cache } from 'next/cache';
import { defaultSearchEngine } from '@mft/search';
import { prisma } from '@mft/db';
import { HomeHeader } from '../components/home/Header';
import { HomeHero } from '../components/home/Hero';
import { HomeSearchBar } from '../components/home/SearchBar';
import { formatWeekdayShort } from '../components/home/PosterCard';
import { mapFestivalToItem, mapShowToItem } from '../lib/listings';
import {
  ResultsBar,
  type SearchFilterType,
} from '../components/search/ResultsBar';
import { ArtistSection } from '../components/search/ArtistSection';
import { EmptyState } from '../components/search/EmptyState';
import { ShowsGrid, type ShowsGridItem } from '../components/common/ShowsGrid';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  type?: string;
}

function isValidFilter(t: string | undefined): t is SearchFilterType {
  return t === 'all' || t === 'artist' || t === 'show' || t === 'festival';
}

/**
 * 홈 랜딩(검색어 없음)의 다가오는 공연/페스티벌 데이터.
 * 페이지는 searchParams 때문에 동적이지만, 이 DB 조회 자체는 요청 간 캐시.
 * startOfTodayMs는 자정으로 0 처리되어 하루 동안 동일 → 일자별 캐시 키.
 */
const getUpcomingData = unstable_cache(
  async (startOfTodayMs: number) => {
    const startOfToday = new Date(startOfTodayMs);
    return Promise.all([
      prisma.festival.findMany({
        where: {
          status: 'APPROVED', // v7: 사이트 공개 큐레이션은 승인된 행만
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
          status: 'APPROVED', // v7
          // v6: include shows currently mid-run (lastSessionDate >= today)
          lastSessionDate: { gte: startOfToday },
          completeness: { gte: 1 },
          duplicateOfShowId: null,
          festivalId: null,
        },
        orderBy: [{ firstSessionDate: 'asc' }],
        take: 8,
        select: {
          id: true,
          firstSessionDate: true,
          lastSessionDate: true,
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
  },
  ['home-upcoming-v1'],
  { revalidate: 86400, tags: ['home', 'shows', 'festivals'] }, // 관리자 수정 시 태그로 즉시 무효화
);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = '', type } = await searchParams;
  const trimmed = q.trim();
  const filter: SearchFilterType = isValidFilter(type) ? type : 'all';

  if (!trimmed) {
    // 페스티벌은 카드 1개로 묶고, festivalId가 없는 standalone Show만 ShowCard로.
    // 같은 페스티벌의 lineup child Show가 그리드를 도배하지 않도록.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [upcomingFestivals, upcomingShows] = await getUpcomingData(
      startOfToday.getTime(),
    );

    // 공연/페스티벌을 각각 별도 섹션으로 분리. 매핑·정렬 로직은
    // /shows·/festivals 리스트 페이지와 lib/listings에서 공유.
    const showItems: ShowsGridItem[] = upcomingShows
      .map(mapShowToItem)
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    const festivalItems: ShowsGridItem[] = upcomingFestivals
      .map(mapFestivalToItem)
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

    const year = new Date().getFullYear();

    return (
      <div className="min-h-screen bg-ink-900 font-sans text-paper">
        <HomeHeader />
        <main>
          <section className="mx-auto max-w-[1400px] px-6 pb-12 pt-10 sm:px-10 sm:pt-14">
            <HomeHero />
            <div className="mt-10 sm:mt-12">
              <HomeSearchBar />
            </div>
          </section>
          <ShowsGrid
            items={showItems}
            kicker={`UPCOMING / ${year}`}
            title="다가오는 공연"
            initialLimit={0}
            emptyLabel="예정된 공연이 없습니다."
            headerAction={{ label: '전체 보기', href: '/shows' }}
          />
          <ShowsGrid
            items={festivalItems}
            kicker={`FESTIVALS / ${year}`}
            title="다가오는 페스티벌"
            initialLimit={0}
            emptyLabel="예정된 페스티벌이 없습니다."
            headerAction={{ label: '전체 보기', href: '/festivals' }}
          />
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
            firstSessionDate: true,
            lastSessionDate: true,
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
          // v6: sortDate = lastSessionDate so multi-day shows mid-run still
          // qualify as upcoming; falls back to firstSessionDate for safety.
          sortDate: data.lastSessionDate
            ? new Date(data.lastSessionDate)
            : data.firstSessionDate
              ? new Date(data.firstSessionDate)
              : null,
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

  // PosterCardResult → ShowsGridItem 매핑 (ShowsGrid가 PosterCard 직접 렌더)
  function festivalDayLabel(start: Date | null, end: Date | null): string | null {
    if (!start) return null;
    if (end && end.getTime() !== start.getTime()) {
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${diff} DAYS`;
    }
    return formatWeekdayShort(start);
  }

  function toGridItem(c: PosterCardResult): ShowsGridItem {
    if (c.kind === 'show') {
      const d = c.data.firstSessionDate ? new Date(c.data.firstSessionDate) : null;
      const primaryName = c.data.artists[0]?.canonicalName ?? c.data.title ?? '공연';
      const secondaryTitle = c.data.artists.length > 0 && c.data.title ? c.data.title : null;
      return {
        key: c.key,
        href: `/shows/${c.data.id}`,
        type: 'SHOW',
        imageUrl: c.data.imageUrl,
        primaryName,
        secondaryTitle,
        city: null,
        venueName: c.data.venue?.name ?? null,
        date: d,
        dayLabel: formatWeekdayShort(d),
      };
    }
    const start = c.data.startDate ? new Date(c.data.startDate) : null;
    const end = c.data.endDate ? new Date(c.data.endDate) : null;
    return {
      key: c.key,
      href: `/festivals/${c.data.id}`,
      type: 'FESTIVAL',
      imageUrl: c.data.posterImageUrl,
      primaryName: c.data.name,
      secondaryTitle: null,
      city: null,
      venueName: c.data.locationText ?? null,
      date: start,
      dayLabel: festivalDayLabel(start, end),
    };
  }

  const upcomingItems = visibleUpcoming.map(toGridItem);
  const pastItems = visiblePast.map(toGridItem);

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

            <ShowsGrid
              items={upcomingItems}
              kicker={`UPCOMING / ${new Date().getFullYear()}`}
              title="다가오는 공연"
            />
            <ShowsGrid
              items={pastItems}
              kicker="ARCHIVE"
              title="지난 공연"
            />
          </>
        ) : (
          <EmptyState query={trimmed} />
        )}
      </main>
    </div>
  );
}
