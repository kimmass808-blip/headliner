/**
 * Show 상세 우측 컬럼 — 페스티벌 배너 / 날짜 키커 / 헤드라인 / 메타 dl / 누락 뱃지.
 */

import Link from 'next/link';
import { ArrowUpRight } from '../common/Icons';
import { MetaRow } from '../common/MetaRow';
import { FestivalBanner, type FestivalBannerProps } from './FestivalBanner';
import { MissingFieldsBadge } from './MissingFieldsBadge';

export interface InfoColumnArtist {
  id: string;
  canonicalName: string;
}

export interface InfoColumnProps {
  artists: InfoColumnArtist[];
  title: string | null;
  /** 'YYYY.MM.DD' 형식 */
  dateText: string | null;
  /** ['MM', 'DD'] 분리 — Big Shoulders 키커용. dateText 있을 때만 전달 */
  monthDay: [string, string] | null;
  dayShort: string | null;   // 'SAT'
  dayKr: string | null;      // '토요일'
  startTime: string | null;  // '19:00'
  venueName: string | null;
  city: string | null;
  ticketUrl: string | null;
  ticketLabel: string | null;
  sourceUrl: string;
  sourceLabel: string | null; // '@silicagel.official' 등
  festival: FestivalBannerProps | null;
  missing: string[];
}

export function InfoColumn(props: InfoColumnProps) {
  const {
    artists, title, dateText, monthDay, dayShort, dayKr, startTime,
    venueName, city, ticketUrl, ticketLabel, sourceUrl, sourceLabel,
    festival, missing,
  } = props;

  const artistsLabel = artists.map((a) => a.canonicalName).join(' · ');

  return (
    <div className="flex flex-col">
      <FestivalBanner festival={festival} />

      {/* 날짜 키커 */}
      {(monthDay || dayShort || dayKr || startTime) ? (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/50">
          {monthDay ? (
            <span className="logo-headliner text-[14px] leading-none tabular-nums text-paper">
              {monthDay[0]}
              <span className="text-paper/60">/</span>
              {monthDay[1]}
            </span>
          ) : null}
          {dayShort ? (
            <>
              {monthDay ? <span className="text-dim">·</span> : null}
              <span>{dayShort}</span>
            </>
          ) : null}
          {dayKr ? (
            <>
              <span className="text-dim">·</span>
              <span>{dayKr}</span>
            </>
          ) : null}
          {startTime ? (
            <>
              <span className="text-dim">·</span>
              <span className="font-mono text-paper/80">{startTime}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {/* 아티스트 헤드라인 */}
      <h1 className="mt-5 text-[44px] font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-[52px] lg:text-[60px]">
        {artistsLabel || title || '공연'}
      </h1>

      {/* 공연 타이틀 (서브 라인) */}
      {title && artistsLabel ? (
        <div className="mt-3 text-[20px] font-medium leading-tight tracking-[-0.015em] text-paper/70 sm:text-[22px]">
          {title}
        </div>
      ) : null}

      {/* 메타 dl */}
      <dl className="hairline-t mt-10">
        {dateText ? (
          <MetaRow label="DATE">
            {dateText}
            {dayKr ? <span className="text-paper/45"> · {dayKr}</span> : null}
            {startTime ? (
              <span className="font-mono text-paper/45"> · {startTime} 시작</span>
            ) : null}
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

        {artists.length > 0 ? (
          <MetaRow label="ARTIST">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {artists.map((a) => (
                <Link
                  key={a.id}
                  href={`/artists/${a.id}`}
                  className="text-paper underline decoration-paper/30 underline-offset-4 transition hover:decoration-paper"
                >
                  {a.canonicalName}
                </Link>
              ))}
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

        <MetaRow label="SOURCE">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 text-[13px] text-paper/65 transition hover:text-paper"
          >
            <span className="font-mono">Instagram</span>
            {sourceLabel ? (
              <>
                <span className="text-dim">·</span>
                <span>{sourceLabel}</span>
              </>
            ) : null}
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </MetaRow>
      </dl>

      <MissingFieldsBadge missing={missing} />
    </div>
  );
}
