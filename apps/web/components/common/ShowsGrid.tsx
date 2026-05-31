/**
 * 공통 ShowsGrid — kicker + heading + count + PosterCard 4컬럼.
 * Artist 상세·검색 결과 등에서 공유.
 *
 * `initialLimit` (기본 20) 만큼 먼저 표시하고, 그보다 많으면 "더 보기" 버튼.
 * 카드는 외부에서 매핑된 PosterCard 데이터를 받음.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PosterCard, type HomePosterCardProps } from '../home/PosterCard';

function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

export interface ShowsGridItem extends HomePosterCardProps {
  key: string;
}

export type ShowsGridSort = 'date' | 'name';

export interface ShowsGridProps {
  items: ShowsGridItem[];
  kicker: string;          // 'UPCOMING / 2026'
  title: string;           // '다가오는 공연'
  countSuffix?: string;    // '건' (기본)
  /** 처음 표시할 카드 수. 기본 20. 0 이하면 페이지네이션 없이 전부 표시. */
  initialLimit?: number;
  /** true면 헤더 우측에 정렬 토글(날짜순/가나다순) 표시. 기본 false. */
  sortable?: boolean;
  /**
   * 헤더 우측에 표시할 액션 링크(예: 전체 보기 → /calendar).
   * `sortable`과 동시 지정 시 정렬 토글이 우선한다.
   */
  headerAction?: { label: string; href: string };
  /** 빈 목록일 때 표시할 안내. 지정하면 빈 상태도 렌더(기본은 null 반환). */
  emptyLabel?: string;
}

const SORT_OPTIONS: { key: ShowsGridSort; label: string }[] = [
  { key: 'date', label: '날짜순' },
  { key: 'name', label: '가나다순' },
];

export function ShowsGrid({
  items,
  kicker,
  title,
  countSuffix = '건',
  initialLimit = 20,
  sortable = false,
  headerAction,
  emptyLabel,
}: ShowsGridProps) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<ShowsGridSort>('date');

  const sorted = useMemo(() => {
    if (!sortable) return items;
    return [...items].sort((a, b) =>
      sort === 'name'
        ? a.primaryName.localeCompare(b.primaryName, 'ko')
        : (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity),
    );
  }, [items, sort, sortable]);

  if (!items || items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
        <p className="py-20 text-center text-sm text-paper/40">{emptyLabel}</p>
      </section>
    );
  }

  const hasPagination = initialLimit > 0 && sorted.length > initialLimit;
  const visible = !hasPagination || showAll ? sorted : sorted.slice(0, initialLimit);
  const remaining = sorted.length - initialLimit;

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
      <div className="hairline mb-10 flex items-end justify-between pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            {kicker}
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[32px]">
              {title}
            </h2>
            <span className="text-[14px] tabular-nums text-paper/40">
              {items.length}
              {countSuffix}
            </span>
          </div>
        </div>

        {sortable ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                aria-pressed={sort === opt.key}
                className={
                  'rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ' +
                  (sort === opt.key
                    ? 'bg-paper text-ink-900'
                    : 'text-paper/55 hover:text-paper')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : headerAction ? (
          <Link
            href={headerAction.href}
            className="group hidden shrink-0 items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-paper/70 transition hover:text-paper sm:inline-flex"
          >
            {headerAction.label}
            <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map(({ key, ...cardProps }) => (
          <PosterCard key={key} {...cardProps} />
        ))}
      </div>

      {hasPagination && !showAll ? (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-6 text-[12px] uppercase tracking-[0.2em] text-paper/70 transition hover:border-white/30 hover:text-paper"
          >
            + {remaining}개 더 보기
          </button>
        </div>
      ) : null}
    </section>
  );
}
