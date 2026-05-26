/**
 * 홈 "다가오는 공연" 섹션.
 *
 * 데이터는 page.tsx 측에서 fetch 후 props로 주입.
 * Festival + 단독공연을 하나의 그리드에 인터리브.
 */

import { PosterCard, type HomePosterCardProps } from './PosterCard';

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

export interface UpcomingItem extends HomePosterCardProps {
  key: string;
}

export function UpcomingSection({ items }: { items: UpcomingItem[] }) {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-24 pt-6 sm:px-10">
      <div className="hairline mb-10 flex items-end justify-between pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            UPCOMING / {new Date().getFullYear()}
          </div>
          <h2 className="text-[32px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[40px]">
            다가오는 공연
          </h2>
        </div>
        <a
          href="#search"
          className="group hidden items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-paper/70 transition hover:text-paper sm:inline-flex"
        >
          전체 보기
          <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-1" />
        </a>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ key, ...cardProps }) => (
            <PosterCard key={key} {...cardProps} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-sm text-paper/40">
          예정된 공연이 없습니다.
        </p>
      )}
    </section>
  );
}
