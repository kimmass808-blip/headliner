/**
 * 캘린더 본체 — 7열 × N행 그리드.
 * Day-of-week 헤더 + 날짜 셀 + 이벤트 바 (absolute 포지셔닝).
 */

import {
  DOW_KR,
  assignLanes,
  blockInWeek,
  eventBlocks,
  monthCells,
  sameYMD,
  type CalendarEvent,
  type EventBlock,
} from '../../lib/calendar';
import { EventBar } from './EventBar';

export interface MonthGridProps {
  month: Date;
  events: CalendarEvent[];
  today: Date;
}

const LANE_H = 22;
const LANE_GAP = 4;
const CELL_H = 132;
const HEADER_H = 26;
const MAX_VISIBLE_LANES = 3;

export function MonthGrid({ month, events, today }: MonthGridProps) {
  const cells = monthCells(month);
  const rows: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // 모든 블록 미리 계산 (event flat → blocks)
  const allBlocks: EventBlock[] = events.flatMap(eventBlocks);

  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="w-full">
      {/* Day-of-week 헤더 */}
      <div
        className="grid grid-cols-7"
        style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        {DOW_KR.map((dow, i) => (
          <div
            key={dow}
            className={
              'flex h-9 items-center px-3 text-[10px] uppercase tracking-[0.3em] ' +
              (i === 0 || i === 6 ? 'text-paper/55' : 'text-paper/35')
            }
            style={{ boxShadow: i < 6 ? 'inset -1px 0 0 rgba(255,255,255,0.06)' : 'none' }}
          >
            {dow}
          </div>
        ))}
      </div>

      {/* 주 단위 row */}
      {rows.map((row, ri) => {
        const weekStart = row[0]!;
        const segs: { block: EventBlock; seg: ReturnType<typeof blockInWeek> }[] = [];
        for (const b of allBlocks) {
          const seg = blockInWeek(b, weekStart);
          if (seg) segs.push({ block: b, seg });
        }
        const laneAssignments = assignLanes(
          segs.map((s) => ({ block: s.block, seg: s.seg! })),
        );
        const overflowByCol = Array(7).fill(0);
        const visible = laneAssignments.filter((w) => {
          if (w.lane < MAX_VISIBLE_LANES) return true;
          for (let c = w.seg.startCol; c < w.seg.startCol + w.seg.span; c++) {
            overflowByCol[c]++;
          }
          return false;
        });

        return (
          <div
            key={ri}
            className="relative grid grid-cols-7"
            style={{
              minHeight: CELL_H,
              boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {row.map((d, ci) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameYMD(d, todayDateOnly);
              const isPast = d < todayDateOnly;
              const isWeekend = ci === 0 || ci === 6;
              return (
                <div
                  key={ci}
                  className="relative px-3 pb-2 pt-2.5"
                  style={{
                    boxShadow: ci < 6 ? 'inset -1px 0 0 rgba(255,255,255,0.06)' : 'none',
                    opacity: inMonth ? 1 : 0.35,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={
                        'text-[13px] tabular-nums tracking-tight ' +
                        (isPast && inMonth
                          ? 'text-paper/30'
                          : isWeekend
                            ? 'text-paper/90'
                            : 'text-paper/70')
                      }
                    >
                      {d.getDate()}
                    </span>
                    {isToday ? (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-lime"
                        style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}
                      />
                    ) : null}
                    {d.getDate() === 1 ? (
                      <span className="ml-0.5 text-[9px] uppercase tracking-[0.22em] text-paper/30">
                        {d.getMonth() + 1}월
                      </span>
                    ) : null}
                  </div>
                  {overflowByCol[ci] > 0 ? (
                    <div
                      className="absolute left-3 right-3 cursor-pointer text-[10px] tracking-[0.05em] text-paper/45 transition hover:text-paper"
                      style={{ bottom: 6 }}
                    >
                      + {overflowByCol[ci]}건 더보기
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* 이벤트 바 — row 위에 absolute 배치 */}
            {visible.map((w, i) => {
              const left = (w.seg.startCol / 7) * 100;
              const width = (w.seg.span / 7) * 100;
              const top = HEADER_H + w.lane * (LANE_H + LANE_GAP);
              return (
                <EventBar
                  key={`${w.block.event.id}-${ri}-${i}`}
                  weekBlock={w}
                  style={{
                    left: `calc(${left}% + 6px)`,
                    width: `calc(${width}% - 12px)`,
                    top,
                    height: LANE_H,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
