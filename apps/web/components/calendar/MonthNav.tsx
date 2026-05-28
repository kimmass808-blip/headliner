/**
 * 캘린더 상단 — 키커 + 월 타이틀 + 부제 + 컨트롤 row (prev/next/jump/오늘).
 */

import Link from 'next/link';
import { addDays, formatMonthParam, startOfMonth } from '../../lib/calendar';

export interface MonthNavProps {
  /** 현재 표시 중인 달 (1일) */
  month: Date;
  /** 키커 라벨 */
  label: string;
  /** 부제 (예: "이번 달 6건") */
  sub: string;
  /** 분기 jump 후보 4개 (현재 표시 기준) */
  jumpMonths: Date[];
  /** "오늘" 클릭 시 가는 달 (보통 TODAY가 속한 달) */
  todayMonth: Date;
}

function MonthHref({ d }: { d: Date }) {
  return `/calendar?month=${formatMonthParam(d)}`;
}

function ArrowL({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M14 6l-6 6 6 6" />
    </svg>
  );
}
function ArrowR({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M10 6l6 6-6 6" />
    </svg>
  );
}

export function MonthNav({ month, label, sub, jumpMonths, todayMonth }: MonthNavProps) {
  const prev = addDays(startOfMonth(month), -1); // 전 달의 마지막 날 → startOfMonth로 정규화 권장
  const prevMonth = startOfMonth(prev);
  const next = addDays(startOfMonth(month), 32); // 다음 달 어디 → startOfMonth
  const nextMonth = startOfMonth(next);

  return (
    <div className="hairline flex flex-wrap items-end justify-between gap-y-6 pb-5">
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-paper/45">
          {label}
        </div>
        <div className="flex items-baseline gap-5 whitespace-nowrap">
          <h1 className="logo-headliner text-[48px] leading-none text-paper sm:text-[64px]">
            {`${month.getFullYear()}. ${String(month.getMonth() + 1).padStart(2, '0')}`}
          </h1>
          <span className="text-[13px] uppercase tracking-[0.18em] text-paper/45">
            {sub}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={MonthHref({ d: prevMonth })}
          aria-label="이전 달"
          className="flex h-9 w-9 items-center justify-center border border-white/10 text-paper/70 transition hover:border-white/30 hover:text-paper"
        >
          <ArrowL />
        </Link>
        <Link
          href={MonthHref({ d: nextMonth })}
          aria-label="다음 달"
          className="flex h-9 w-9 items-center justify-center border border-white/10 text-paper/70 transition hover:border-white/30 hover:text-paper"
        >
          <ArrowR />
        </Link>

        <div className="ml-1 inline-flex" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
          {jumpMonths.map((m) => {
            const isActive =
              m.getFullYear() === month.getFullYear() && m.getMonth() === month.getMonth();
            return (
              <Link
                key={formatMonthParam(m)}
                href={MonthHref({ d: m })}
                className={
                  'h-9 px-3 text-[11px] uppercase tracking-[0.18em] transition ' +
                  (isActive
                    ? 'bg-paper text-ink-900'
                    : 'text-paper/55 hover:text-paper')
                }
              >
                {m.getMonth() + 1}월
              </Link>
            );
          })}
        </div>

        <Link
          href={MonthHref({ d: todayMonth })}
          className="ml-1 h-9 px-3 text-[11px] uppercase tracking-[0.18em] text-paper/70 transition hover:text-paper"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}
        >
          <span className="inline-flex h-full items-center">오늘</span>
        </Link>
      </div>
    </div>
  );
}
