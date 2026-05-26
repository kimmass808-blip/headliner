/**
 * 검색 결과 상단 바 — kicker + 검색어 헤드라인 + 카운트 + 필터 탭(전체/아티스트/공연/페스티벌)
 * + 정렬 옵션(placeholder).
 *
 * 필터 탭 클릭 시 URL `?q=...&type=...` 갱신 (Next.js Link).
 */

import Link from 'next/link';

export type SearchFilterType = 'all' | 'artist' | 'show' | 'festival';

export interface ResultsBarProps {
  query: string;
  filter: SearchFilterType;
  totals: Record<SearchFilterType, number>;
}

const TABS: Array<{ id: SearchFilterType; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'artist', label: '아티스트' },
  { id: 'show', label: '공연' },
  { id: 'festival', label: '페스티벌' },
];

function tabHref(query: string, filter: SearchFilterType): string {
  const params = new URLSearchParams();
  params.set('q', query);
  if (filter !== 'all') params.set('type', filter);
  return `/?${params.toString()}`;
}

export function ResultsBar({ query, filter, totals }: ResultsBarProps) {
  return (
    <div className="mx-auto mt-12 max-w-[1400px] px-6 sm:mt-14 sm:px-10">
      <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/50">
        <span className="h-1.5 w-1.5 rounded-full bg-paper/60" />
        <span>SEARCH RESULTS</span>
      </div>
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[40px]">
        <span className="text-paper/55">&quot;</span>
        {query}
        <span className="text-paper/55">&quot;</span>
        <span className="ml-3 text-[20px] font-medium tracking-[-0.01em] text-paper/45 sm:text-[28px]">
          결과 {totals.all}건
        </span>
      </h1>

      <div className="hairline mt-8 flex flex-wrap gap-1 pb-4">
        {TABS.map((tab) => {
          const active = tab.id === filter;
          return (
            <Link
              key={tab.id}
              href={tabHref(query, tab.id)}
              className={
                'inline-flex h-9 items-center gap-2 rounded-full border px-4 transition ' +
                (active
                  ? 'border-paper bg-paper text-ink-900'
                  : 'border-white/10 text-paper/70 hover:border-white/30 hover:text-paper')
              }
            >
              <span className="text-[13px] font-medium leading-none tracking-[-0.01em]">
                {tab.label}
              </span>
              <span
                className={
                  'text-[11px] leading-none tabular-nums ' +
                  (active ? 'text-ink-900/60' : 'text-paper/40')
                }
              >
                {totals[tab.id]}
              </span>
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3 self-center text-[11px] uppercase tracking-[0.2em] text-paper/50">
          <span>정렬</span>
          <span className="text-paper">관련도</span>
        </div>
      </div>
    </div>
  );
}
