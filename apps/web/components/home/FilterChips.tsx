/**
 * 홈 필터 칩.
 *
 * 시각적 placeholder — 현재는 selected state만 관리, 실제 필터링 로직은 별도 작업.
 * 검색 결과 페이지 합치는 단계에서 querystring 매핑 예정.
 */

'use client';

import { useState } from 'react';

const FILTERS = ['전체', '이번 주', '이번 달', '서울', '부산·대구', '페스티벌'] as const;

export function HomeFilterChips() {
  const [selected, setSelected] = useState<string>('전체');

  return (
    <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
      {FILTERS.map((f) => {
        const active = selected === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => setSelected(f)}
            className={
              'h-8 rounded-full border px-3.5 text-[12px] tracking-[0.02em] transition ' +
              (active
                ? 'border-paper bg-paper text-ink-900'
                : 'border-white/10 text-paper/70 hover:border-white/30 hover:text-paper')
            }
          >
            {f}
          </button>
        );
      })}
      <div className="flex h-8 items-center rounded-full border border-dashed border-white/10 px-3.5 text-[12px] text-dim">
        + 직접 필터
      </div>
    </div>
  );
}
