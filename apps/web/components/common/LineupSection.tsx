/**
 * 공유 라인업 섹션 — Festival 상세 + 페스티벌 소속 Show 상세에서 모두 사용.
 *
 * 사양: design_handoff_headliner_lineup. 시간/스테이지 정보 없이 칩만 표시 (의도된 단순화).
 * 칩 클릭 시 페스티벌 내 해당 아티스트의 Show 상세 페이지로 이동.
 * `isHere` 칩은 비활성 (자기 페이지를 가리키지 않게).
 */

import Link from 'next/link';
import { ArrowUpRight } from './Icons';
import { ArtistChip } from './ArtistChip';

export interface LineupChipData {
  name: string;
  /** 이 아티스트가 출연하는 (이 페스티벌 내) Show id */
  showId: string;
  /** 현재 보고 있는 Show가 자신일 때 true */
  isHere?: boolean;
}

export interface LineupDayData {
  /** 'DAY 1' */
  label: string;
  /** 'YYYY.MM.DD' */
  date: string;
  /** 'FRI' / 'SAT' / 'SUN' */
  dayKr: string;
  /** 이 날 현재 Show의 출연 아티스트명 (있으면 day header 우측에 마커 표시) */
  hereArtist?: string;
  chips: LineupChipData[];
}

export interface LineupSectionProps {
  totalArtists: number;
  days: LineupDayData[];
  /** "페스티벌 전체 보기" 링크 href. 자기(festival) 페이지면 undefined로 숨김. */
  festivalLinkHref?: string;
}

function LineupDayHeader({ day }: { day: LineupDayData }) {
  const [, mm, dd] = day.date.split('.');
  return (
    <div className="hairline mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 pb-3">
      <span className="text-[11px] uppercase tracking-[0.3em] text-paper/45">
        {day.label}
      </span>
      <span className="logo-headliner text-[22px] leading-none text-paper">
        {mm}
        <span className="text-paper/45">.</span>
        {dd}
      </span>
      <span className="text-[12px] uppercase tracking-[0.18em] text-paper/55">
        {day.dayKr}
      </span>
      {day.hereArtist ? (
        <span className="ml-auto inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-paper">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-paper"
            style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}
          />
          이 날 공연
        </span>
      ) : null}
    </div>
  );
}

export function LineupSection({
  totalArtists,
  days,
  festivalLinkHref,
}: LineupSectionProps) {
  const hasHere = days.some((d) => d.chips.some((c) => c.isHere));

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
      {/* heading */}
      <div className="hairline mb-8 flex flex-wrap items-end justify-between gap-y-4 pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            LINEUP
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
              라인업
            </h2>
            <span className="text-[14px] tabular-nums text-paper/40">
              {totalArtists}팀
            </span>
          </div>
        </div>
        {festivalLinkHref ? (
          <Link
            href={festivalLinkHref}
            className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-paper/55 transition hover:text-paper"
          >
            페스티벌 전체 보기
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      {/* day-grouped chip lists */}
      {days.map((d, di) => (
        <div key={d.label} className={di > 0 ? 'mt-10' : ''}>
          <LineupDayHeader day={d} />
          <div className="flex flex-wrap gap-2">
            {d.chips.map((c) => (
              <ArtistChip
                key={`${d.label}-${c.name}`}
                name={c.name}
                href={c.isHere ? undefined : `/shows/${c.showId}`}
                variant={c.isHere ? 'here' : 'default'}
              />
            ))}
          </div>
        </div>
      ))}

      {/* footer note */}
      <div className="mt-10 flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-[0.22em] text-paper/40">
        {hasHere ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-paper"
              style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}
            />
            THIS SET — 지금 보는 공연
          </span>
        ) : null}
        <span className="ml-auto text-paper/30">
          라인업은 변경될 수 있습니다.
        </span>
      </div>
    </section>
  );
}
