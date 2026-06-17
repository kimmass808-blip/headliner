/**
 * 스크랩 보관함 본문 (client).
 *
 * 스크랩 id는 localStorage에만 있으므로 마운트 후 /api/scrapped로 하이드레이트.
 * 공연·페스티벌 두 블록을 기존 ShowsGrid로 렌더. 정렬 토글(추가순/날짜순) 제공.
 * scrapStorage.subscribe로 같은 탭·다른 탭의 스크랩 해제를 실시간 반영.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShowsGrid, type ShowsGridItem } from '../common/ShowsGrid';
import { formatWeekdayShort } from '../home/PosterCard';
import { getScraps, subscribe, type Scrap } from '../../lib/scrapStorage';

interface ScrappedShow {
  id: string;
  title: string | null;
  imageUrl: string | null;
  firstSessionDate: string | null;
  venue: { name: string } | null;
  artists: { canonicalName: string }[];
}

interface ScrappedFestival {
  id: string;
  name: string;
  posterImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  locationText: string | null;
}

interface HydrateResponse {
  shows: ScrappedShow[];
  festivals: ScrappedFestival[];
}

type SortMode = 'added' | 'date';

function festivalDayLabel(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  if (end && end.getTime() !== start.getTime()) {
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${diff} DAYS`;
  }
  return formatWeekdayShort(start);
}

export function ScrappedView() {
  const [loading, setLoading] = useState(true);
  const [shows, setShows] = useState<ScrappedShow[]>([]);
  const [festivals, setFestivals] = useState<ScrappedFestival[]>([]);
  // id → addedAt (정렬용). 하이드레이션 결과는 순서 보장이 없으므로 별도 보관.
  const [addedAt, setAddedAt] = useState<Map<string, string>>(new Map());
  const [sort, setSort] = useState<SortMode>('added');

  const hydrate = useCallback(async (scraps: Scrap[]) => {
    const at = new Map<string, string>();
    for (const s of scraps) at.set(`${s.kind}:${s.id}`, s.addedAt);
    setAddedAt(at);

    if (scraps.length === 0) {
      setShows([]);
      setFestivals([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/scrapped', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: scraps.map((s) => ({ kind: s.kind, id: s.id })) }),
      });
      const data: HydrateResponse = await res.json();
      setShows(Array.isArray(data.shows) ? data.shows : []);
      setFestivals(Array.isArray(data.festivals) ? data.festivals : []);
    } catch {
      setShows([]);
      setFestivals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate(getScraps());
    // 스크랩 해제/추가 시 재하이드레이트 (같은 탭 + 다른 탭)
    const unsub = subscribe(() => {
      void hydrate(getScraps());
    });
    return unsub;
  }, [hydrate]);

  const showItems: ShowsGridItem[] = useMemo(() => {
    const mapped = shows.map((s) => {
      const d = s.firstSessionDate ? new Date(s.firstSessionDate) : null;
      const primaryName = s.artists[0]?.canonicalName ?? s.title ?? '공연';
      const secondaryTitle = s.artists.length > 0 && s.title ? s.title : null;
      return {
        item: {
          key: s.id,
          href: `/shows/${s.id}`,
          type: 'SHOW' as const,
          imageUrl: s.imageUrl,
          primaryName,
          secondaryTitle,
          city: null,
          venueName: s.venue?.name ?? null,
          date: d,
          dayLabel: formatWeekdayShort(d),
        },
        addedAt: addedAt.get(`show:${s.id}`) ?? '',
        sortDate: d ? d.getTime() : 0,
      };
    });
    mapped.sort((a, b) =>
      sort === 'added'
        ? b.addedAt.localeCompare(a.addedAt) // 최근 스크랩 우선
        : b.sortDate - a.sortDate, // 가까운 날짜 우선
    );
    return mapped.map((m) => m.item);
  }, [shows, addedAt, sort]);

  const festivalItems: ShowsGridItem[] = useMemo(() => {
    const mapped = festivals.map((f) => {
      const start = f.startDate ? new Date(f.startDate) : null;
      const end = f.endDate ? new Date(f.endDate) : null;
      return {
        item: {
          key: f.id,
          href: `/festivals/${f.id}`,
          type: 'FESTIVAL' as const,
          imageUrl: f.posterImageUrl,
          primaryName: f.name,
          secondaryTitle: null,
          city: null,
          venueName: f.locationText ?? null,
          date: start,
          dayLabel: festivalDayLabel(start, end),
        },
        addedAt: addedAt.get(`festival:${f.id}`) ?? '',
        sortDate: start ? start.getTime() : 0,
      };
    });
    mapped.sort((a, b) =>
      sort === 'added' ? b.addedAt.localeCompare(a.addedAt) : b.sortDate - a.sortDate,
    );
    return mapped.map((m) => m.item);
  }, [festivals, addedAt, sort]);

  const total = showItems.length + festivalItems.length;

  // 로딩 — 짧은 스켈레톤
  if (loading) {
    return (
      <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] w-full rounded-lg bg-white/[0.04]" />
              <div className="mt-3 h-3 w-2/3 rounded bg-white/[0.04]" />
              <div className="mt-2 h-3 w-1/3 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 빈 상태
  if (total === 0) {
    return (
      <section className="mx-auto mt-24 max-w-[1400px] px-6 text-center sm:px-10">
        <p className="text-[15px] text-paper/55">아직 스크랩한 항목이 없어요.</p>
        <Link
          href="/"
          className="mt-5 inline-block text-[13px] tracking-[0.02em] text-paper transition hover:opacity-80"
        >
          공연 둘러보기 →
        </Link>
      </section>
    );
  }

  return (
    <>
      {/* 정렬 토글 */}
      <section className="mx-auto mt-12 max-w-[1400px] px-6 sm:mt-16 sm:px-10">
        <div className="flex items-center justify-end gap-1 text-[12px] tracking-[0.02em]">
          <button
            type="button"
            onClick={() => setSort('added')}
            aria-pressed={sort === 'added'}
            className={
              'rounded-full px-3 py-1.5 transition ' +
              (sort === 'added'
                ? 'bg-white/10 text-paper'
                : 'text-paper/45 hover:text-paper/80')
            }
          >
            추가순
          </button>
          <button
            type="button"
            onClick={() => setSort('date')}
            aria-pressed={sort === 'date'}
            className={
              'rounded-full px-3 py-1.5 transition ' +
              (sort === 'date'
                ? 'bg-white/10 text-paper'
                : 'text-paper/45 hover:text-paper/80')
            }
          >
            날짜순
          </button>
        </div>
      </section>

      {showItems.length > 0 && (
        <ShowsGrid items={showItems} kicker="SCRAPPED" title="스크랩한 공연" />
      )}
      {festivalItems.length > 0 && (
        <ShowsGrid items={festivalItems} kicker="SCRAPPED" title="스크랩한 페스티벌" />
      )}
    </>
  );
}
