/**
 * Calendar 페이지용 순수 유틸 — 날짜 계산, 블록 그룹, 주별 lane 할당.
 * 디자인 핸드오프 calendar-app.jsx와 동일 시그니처.
 */

export const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface CalendarSession {
  /** YYYY-MM-DD */
  date: string;
  startTime: string | null;
  venue: string;
  city: string | null;
}

export interface CalendarEvent {
  id: string;
  kind: 'SHOW' | 'FESTIVAL';
  primaryName: string;
  secondaryTitle: string | null;
  poster: string | null;
  sessions: CalendarSession[];
}

/** 한 이벤트를 연속/비연속 블록으로 그룹화. */
export interface EventBlock {
  event: CalendarEvent;
  sessions: CalendarSession[];
  start: Date;
  end: Date;
  span: number;
  seq: { i: number; total: number } | null;
}

export interface WeekSegment {
  startCol: number;
  span: number;
  leftClipped: boolean;
  rightClipped: boolean;
}

export interface WeekBlock {
  block: EventBlock;
  seg: WeekSegment;
  lane: number;
}

// ─── date helpers ────────────────────────────────────────────────────────────
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sameYMD(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

export function diffDays(a: Date, b: Date): number {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86_400_000);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Sunday-start 일자 시작점 — 그 달 1일이 속한 주의 일요일. */
export function startOfMonthGrid(d: Date): Date {
  const first = startOfMonth(d);
  return addDays(first, -first.getDay());
}

/** 월 그리드 셀 배열 — 35 또는 42개 (마지막 주가 다른 달이면 트림). */
export function monthCells(d: Date): Date[] {
  const start = startOfMonthGrid(d);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  const monthIdx = d.getMonth();
  while (
    cells.length > 35 &&
    cells[cells.length - 1]!.getMonth() !== monthIdx &&
    cells[cells.length - 7]!.getMonth() !== monthIdx
  ) {
    cells.splice(cells.length - 7, 7);
  }
  return cells;
}

/**
 * 이벤트의 세션을 블록으로 그룹.
 * - 연속된 같은 venue 세션 = 1 블록 (페스티벌)
 * - 비연속 또는 다른 venue = 별도 블록 (투어), `i/total` 라벨 부여
 */
export function eventBlocks(ev: CalendarEvent): EventBlock[] {
  const sorted = [...ev.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const grouped: { sessions: CalendarSession[] }[] = [];
  for (const s of sorted) {
    const last = grouped[grouped.length - 1];
    if (last) {
      const lastEnd = parseYMD(last.sessions[last.sessions.length - 1]!.date);
      const next = parseYMD(s.date);
      if (diffDays(lastEnd, next) === 1 && s.venue === last.sessions[0]!.venue) {
        last.sessions.push(s);
        continue;
      }
    }
    grouped.push({ sessions: [s] });
  }
  const total = grouped.length;
  return grouped.map((b, i) => ({
    event: ev,
    sessions: b.sessions,
    start: parseYMD(b.sessions[0]!.date),
    end: parseYMD(b.sessions[b.sessions.length - 1]!.date),
    span: b.sessions.length,
    seq: total > 1 ? { i: i + 1, total } : null,
  }));
}

/** 한 주(7일) 안에서 블록의 columns. 블록이 주에 안 걸리면 null. */
export function blockInWeek(block: EventBlock, weekStart: Date): WeekSegment | null {
  const weekEnd = addDays(weekStart, 6);
  if (block.end < weekStart || block.start > weekEnd) return null;
  const startCol = Math.max(0, diffDays(weekStart, block.start));
  const endCol = Math.min(6, diffDays(weekStart, block.end));
  return {
    startCol,
    span: endCol - startCol + 1,
    leftClipped: block.start < weekStart,
    rightClipped: block.end > weekEnd,
  };
}

/** Greedy lane 할당 — bars가 겹치지 않게 lane 0,1,2…에 배치. */
export function assignLanes(
  weekBlocks: { block: EventBlock; seg: WeekSegment }[],
): WeekBlock[] {
  const lanes: { startCol: number; endCol: number }[][] = [];
  return weekBlocks
    .slice()
    .sort((a, b) => a.seg.startCol - b.seg.startCol || b.seg.span - a.seg.span)
    .map((wb) => {
      const { startCol, span } = wb.seg;
      const endCol = startCol + span - 1;
      let laneIdx = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const lane = lanes[laneIdx];
        if (!lane) {
          lanes.push([{ startCol, endCol }]);
          break;
        }
        const conflict = lane.some(
          (r) => !(endCol < r.startCol || startCol > r.endCol),
        );
        if (!conflict) {
          lane.push({ startCol, endCol });
          break;
        }
        laneIdx++;
      }
      return { ...wb, lane: laneIdx };
    });
}

/** "YYYY-MM" 문자열을 그 달 1일 Date로. 잘못된 입력은 null. */
export function parseMonthParam(input: string | undefined): Date | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(input);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

/** Date → "YYYY-MM" 문자열. */
export function formatMonthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 한 달 통계 — SummaryStrip용. */
export interface MonthSummary {
  total: number;
  shows: number;
  festivals: number;
  weekend: number;
}

export function summarizeMonth(events: CalendarEvent[], month: Date): MonthSummary {
  const monthStart = startOfMonth(month);
  const monthEnd = addDays(startOfMonth(addDays(monthStart, 32)), -1); // 다음달 1일 - 1
  let shows = 0;
  let festivals = 0;
  let weekend = 0;
  const counted = new Set<string>();
  for (const e of events) {
    let touchesMonth = false;
    for (const s of e.sessions) {
      const d = parseYMD(s.date);
      if (d >= monthStart && d <= monthEnd) {
        touchesMonth = true;
        const dow = d.getDay();
        if (dow === 0 || dow === 5 || dow === 6) {
          if (!counted.has(`weekend:${e.id}`)) {
            weekend++;
            counted.add(`weekend:${e.id}`);
          }
        }
      }
    }
    if (touchesMonth) {
      if (e.kind === 'FESTIVAL') festivals++;
      else shows++;
    }
  }
  return { total: shows + festivals, shows, festivals, weekend };
}
