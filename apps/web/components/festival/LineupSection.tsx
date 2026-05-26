/**
 * Festival 라인업 — day → stage → shows 구조의 그리드.
 * Show 상세의 SetlistSection과 같은 위치·톤.
 */

import Link from 'next/link';

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface LineupShow {
  id: string;
  startTime: string | null;
  stage: string | null;
  artists: { id: string; canonicalName: string }[];
  hasSetlist: boolean;
}

export interface LineupSectionProps {
  /** day key (YYYY-MM-DD) → stage name → shows */
  dayMap: Map<string, Map<string, LineupShow[]>>;
  totalShows: number;
}

function formatDayLabel(dayKey: string): string {
  if (dayKey === 'unknown') return '(날짜 미정)';
  const d = new Date(dayKey);
  if (Number.isNaN(d.getTime())) return dayKey;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAY_KR[d.getDay()];
  return `${month}월 ${day}일 · ${weekday}`;
}

export function LineupSection({ dayMap, totalShows }: LineupSectionProps) {
  const days = Array.from(dayMap.keys()).sort();

  if (days.length === 0) {
    return (
      <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
        <div className="hairline mb-10 pb-6">
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            LINEUP
          </div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
            라인업
          </h2>
        </div>
        <div className="rounded-md border border-dashed border-white/10 py-16 text-center">
          <div className="text-[14px] text-paper/40">라인업 미등록</div>
          <div className="mt-2 text-[12px] text-paper/30">
            아티스트가 추가되면 day · 스테이지별로 표시됩니다.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
      <div className="hairline mb-10 flex items-end justify-between pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            LINEUP
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
              라인업
            </h2>
            <span className="text-[14px] tabular-nums text-paper/40">
              {totalShows}팀
            </span>
          </div>
        </div>
        {days.length > 1 ? (
          <div className="hidden text-[11px] uppercase tracking-[0.2em] text-paper/45 sm:block">
            {days.length}일간
          </div>
        ) : null}
      </div>

      <div className="space-y-16">
        {days.map((dayKey) => {
          const stages = dayMap.get(dayKey)!;
          return (
            <div key={dayKey}>
              <h3 className="text-[20px] font-bold tracking-[-0.02em] text-paper sm:text-[24px]">
                {formatDayLabel(dayKey)}
              </h3>
              <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from(stages.entries()).map(([stage, shows]) => (
                  <div key={stage}>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-paper/45">
                      {stage}
                    </p>
                    <ul className="mt-3">
                      {shows.map((show) => (
                        <li key={show.id} className="hairline py-3">
                          <Link
                            href={`/shows/${show.id}`}
                            className="group flex items-baseline gap-3 transition"
                          >
                            {show.startTime ? (
                              <span className="font-mono text-[12px] tabular-nums text-paper/45">
                                {show.startTime}
                              </span>
                            ) : null}
                            <span className="flex-1 text-[15px] text-paper/85 transition group-hover:text-paper">
                              {show.artists.length > 0
                                ? show.artists.map((a) => a.canonicalName).join(', ')
                                : <span className="text-paper/40">아티스트 미정</span>}
                            </span>
                            {show.hasSetlist ? (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-paper/45">
                                Setlist
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
