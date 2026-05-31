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

/** v6: One ShowSession formatted for display. */
export interface ShowSessionView {
  date: string;             // 'YYYY.MM.DD'
  monthDay: [string, string]; // ['MM', 'DD']
  dayShort: string;         // 'SAT'
  dayKr: string;            // '토요일'
  startTime: string | null; // '19:00'
  ticketUrl: string | null;
  ticketLabel: string | null;
}

export interface InfoColumnProps {
  artists: InfoColumnArtist[];
  title: string | null;
  /** v6: per-day performances. Empty = no date known. */
  sessions: ShowSessionView[];
  venueName: string | null;
  city: string | null;
  sourceUrl: string;
  sourceLabel: string | null; // '@silicagel.official' 등
  festival: FestivalBannerProps | null;
  missing: string[];
}

export function InfoColumn(props: InfoColumnProps) {
  const {
    artists, title, sessions,
    venueName, city, sourceUrl, sourceLabel,
    festival, missing,
  } = props;

  const artistsLabel = artists.map((a) => a.canonicalName).join(' · ');
  const first = sessions[0] ?? null;
  const last  = sessions.length > 0 ? sessions[sessions.length - 1]! : null;
  const isMulti = sessions.length > 1;

  // v6: Collapse ticket rows when all sessions share the same URL.
  const ticketsAreUniform =
    isMulti && first?.ticketUrl
      ? sessions.every((s) => s.ticketUrl === first.ticketUrl)
      : false;

  return (
    <div className="flex flex-col">
      <FestivalBanner festival={festival} />

      {/* 날짜 키커 — single: 첫 세션, multi: 범위 */}
      {first ? (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/50">
          <span className="logo-headliner text-[14px] leading-none tabular-nums text-paper">
            {first.monthDay[0]}
            <span className="text-paper/60">/</span>
            {first.monthDay[1]}
            {isMulti && last && last !== first ? (
              <>
                <span className="px-1 text-paper/60">–</span>
                {last.monthDay[0]}
                <span className="text-paper/60">/</span>
                {last.monthDay[1]}
              </>
            ) : null}
          </span>
          {isMulti ? (
            <>
              <span className="text-dim">·</span>
              <span>{sessions.length}회차</span>
            </>
          ) : (
            <>
              <span className="text-dim">·</span>
              <span>{first.dayShort}</span>
              <span className="text-dim">·</span>
              <span>{first.dayKr}</span>
              {first.startTime ? (
                <>
                  <span className="text-dim">·</span>
                  <span className="font-mono text-paper/80">{first.startTime}</span>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* 공연 타이틀 헤드라인 */}
      <h1 className="mt-5 text-[44px] font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-[52px] lg:text-[60px]">
        {title || artistsLabel || '공연'}
      </h1>

      {/* 아티스트 (서브 라인) */}
      {artistsLabel && title ? (
        <div className="mt-3 text-[20px] font-medium leading-tight tracking-[-0.015em] text-paper/70 sm:text-[22px]">
          {artistsLabel}
        </div>
      ) : null}

      {/* 메타 dl */}
      <dl className="hairline-t mt-10">
        {first ? (
          <MetaRow label={isMulti ? `DATE (${sessions.length}회차)` : 'DATE'}>
            {isMulti ? (
              <ul className="flex flex-col gap-1.5">
                {sessions.map((s) => (
                  <li key={s.date} className="flex flex-wrap items-baseline gap-x-2 text-paper">
                    <span>{s.date}</span>
                    <span className="text-paper/45">· {s.dayKr}</span>
                    {s.startTime ? (
                      <span className="font-mono text-paper/45">· {s.startTime} 시작</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {first.date}
                <span className="text-paper/45"> · {first.dayKr}</span>
                {first.startTime ? (
                  <span className="font-mono text-paper/45"> · {first.startTime} 시작</span>
                ) : null}
              </>
            )}
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

        {/* TICKET — single | uniform multi (1 row) | per-session multi (N rows) */}
        {first?.ticketUrl && (!isMulti || ticketsAreUniform) ? (
          <MetaRow label="TICKET">
            <a
              href={first.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 text-paper/85 transition hover:text-paper"
            >
              {first.ticketLabel ?? '예매 페이지'}
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </MetaRow>
        ) : null}
        {isMulti && !ticketsAreUniform && sessions.some((s) => s.ticketUrl) ? (
          <MetaRow label="TICKET">
            <ul className="flex flex-col gap-1.5">
              {sessions
                .filter((s) => s.ticketUrl)
                .map((s) => (
                  <li key={s.date} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-paper/55">{s.dayKr}</span>
                    <a
                      href={s.ticketUrl!}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-center gap-1.5 text-paper/85 transition hover:text-paper"
                    >
                      {s.ticketLabel ?? '예매 페이지'}
                      <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </li>
                ))}
            </ul>
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
