/**
 * 공통 ShowsGrid — kicker + heading + count + PosterCard 4컬럼.
 * Artist 상세·검색 결과 등에서 공유.
 *
 * `initialLimit` (기본 20) 만큼 먼저 표시하고, 그보다 많으면 "더 보기" 버튼.
 * 카드는 외부에서 매핑된 PosterCard 데이터를 받음.
 */

'use client';

import { useState } from 'react';
import { PosterCard, type HomePosterCardProps } from '../home/PosterCard';

export interface ShowsGridItem extends HomePosterCardProps {
  key: string;
}

export interface ShowsGridProps {
  items: ShowsGridItem[];
  kicker: string;          // 'UPCOMING / 2026'
  title: string;           // '다가오는 공연'
  countSuffix?: string;    // '건' (기본)
  /** 처음 표시할 카드 수. 기본 20. 0 이하면 페이지네이션 없이 전부 표시. */
  initialLimit?: number;
}

export function ShowsGrid({
  items,
  kicker,
  title,
  countSuffix = '건',
  initialLimit = 20,
}: ShowsGridProps) {
  const [showAll, setShowAll] = useState(false);

  if (!items || items.length === 0) return null;

  const hasPagination = initialLimit > 0 && items.length > initialLimit;
  const visible = !hasPagination || showAll ? items : items.slice(0, initialLimit);
  const remaining = items.length - initialLimit;

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
