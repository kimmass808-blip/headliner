/**
 * Festival 상세 우측 컬럼 — 날짜 키커 / 헤드라인 / 메타 dl.
 *
 * Show용 InfoColumn과 구조는 유사하지만:
 * - 날짜가 단일 vs 범위
 * - artists 없음 (페스티벌은 lineup이 별도 섹션)
 * - SOURCE 메타 없음 (스키마에 originalPostUrl 없음)
 *
 * 노트: 과거 `description` prose 블록은 IG 원문 raw text라 가독성 0 + 메타 row와
 * 정보 중복이라 제거. 큐레이션된 소개글이 필요해지면 별도 필드로 추가.
 */

import { ArrowUpRight } from '../common/Icons';
import { MetaRow } from '../common/MetaRow';

export interface FestivalInfoColumnProps {
  name: string;
  /** "2026.08.08 ~ 08.10" 또는 "2026.08.08" 형식 */
  dateText: string | null;
  /** ['MM', 'DD'] — 시작일 기준 키커 */
  startMonthDay: [string, string] | null;
  /** "FRI" 등 — 단일일이면 표시, 다일이면 N DAYS */
  dayBadge: string | null;
  dayKrRange: string | null; // "금~일" 또는 "금요일"
  venueName: string | null;
  city: string | null;
  ticketUrl: string | null;
  ticketLabel: string | null;
  officialUrl: string | null;
}

export function FestivalInfoColumn(props: FestivalInfoColumnProps) {
  const {
    name, dateText, startMonthDay, dayBadge, dayKrRange,
    venueName, city, ticketUrl, ticketLabel, officialUrl,
  } = props;

  return (
    <div className="flex flex-col">
      {/* kicker */}
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/50">
        {startMonthDay ? (
          <span className="logo-headliner text-[14px] leading-none tabular-nums text-paper">
            {startMonthDay[0]}
            <span className="text-paper/60">/</span>
            {startMonthDay[1]}
          </span>
        ) : null}
        {dayBadge ? (
          <>
            {startMonthDay ? <span className="text-dim">·</span> : null}
            <span>{dayBadge}</span>
          </>
        ) : null}
        <span className="text-dim">·</span>
        <span>FESTIVAL</span>
      </div>

      {/* 페스티벌명 헤드라인 */}
      <h1 className="mt-5 text-[44px] font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-[52px] lg:text-[60px]">
        {name}
      </h1>

      {/* 메타 dl */}
      <dl className="hairline-t mt-10">
        {dateText ? (
          <MetaRow label="DATE">
            {dateText}
            {dayKrRange ? <span className="text-paper/45"> · {dayKrRange}</span> : null}
          </MetaRow>
        ) : null}

        {venueName ? (
          <MetaRow label="VENUE">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-paper">{venueName}</span>
              {city ? <span className="text-paper/50">— {city}</span> : null}
            </div>
          </MetaRow>
        ) : null}

        {ticketUrl ? (
          <MetaRow label="TICKET">
            <a
              href={ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 text-paper/85 transition hover:text-paper"
            >
              {ticketLabel ?? '예매 페이지'}
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </MetaRow>
        ) : null}

        {officialUrl ? (
          <MetaRow label="OFFICIAL">
            <a
              href={officialUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 text-paper/85 transition hover:text-paper"
            >
              공식 사이트
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </MetaRow>
        ) : null}
      </dl>
    </div>
  );
}
