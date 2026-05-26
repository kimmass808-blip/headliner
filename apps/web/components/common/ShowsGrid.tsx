/**
 * 공통 ShowsGrid — kicker + heading + count + PosterCard 4컬럼.
 * Artist 상세·검색 결과 등에서 공유.
 *
 * 카드는 외부에서 매핑된 PosterCard 데이터를 받음.
 */

import { PosterCard, type HomePosterCardProps } from '../home/PosterCard';

export interface ShowsGridItem extends HomePosterCardProps {
  key: string;
}

export interface ShowsGridProps {
  items: ShowsGridItem[];
  kicker: string;        // 'UPCOMING / 2026'
  title: string;         // '다가오는 공연'
  countSuffix?: string;  // '건' (기본)
}

export function ShowsGrid({ items, kicker, title, countSuffix = '건' }: ShowsGridProps) {
  if (!items || items.length === 0) return null;
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
        {items.map(({ key, ...cardProps }) => (
          <PosterCard key={key} {...cardProps} />
        ))}
      </div>
    </section>
  );
}
