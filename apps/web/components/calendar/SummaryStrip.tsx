/**
 * 캘린더 상단 요약 strip — 4셀 (총 / 단독 / 페스티벌 / 주말).
 */

import type { MonthSummary } from '../../lib/calendar';

export interface SummaryStripProps {
  summary: MonthSummary;
  monthLabel: string; // '6월' 등
}

export function SummaryStrip({ summary, monthLabel }: SummaryStripProps) {
  const cells = [
    { k: '총 이벤트', v: String(summary.total), sub: monthLabel },
    { k: '단독공연', v: String(summary.shows), sub: 'SHOW' },
    { k: '페스티벌', v: String(summary.festivals), sub: 'FESTIVAL' },
    { k: '주말 공연', v: String(summary.weekend), sub: '금·토·일' },
  ];
  return (
    <div
      className="mb-8 mt-6 grid grid-cols-2 gap-px sm:grid-cols-4"
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      {cells.map((c) => (
        <div key={c.k} className="bg-ink-900 px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-paper/40">{c.k}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="logo-headliner text-[32px] leading-none text-paper">{c.v}</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-paper/40">{c.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
