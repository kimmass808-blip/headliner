// Headliner — Calendar Page (Option A · Month Grid)
// Mock data is inline (2026-06~09 sample events). In production, fetch from API.

// ─── mock data — 2026 June–September ─────────────────────────────────────────
const TODAY = new Date(2026, 4, 28); // 2026-05-28 (Thu)

const EVENTS = [
  { id: 'baekyerin', kind: 'SHOW', primaryName: '백예린',
    secondaryTitle: '그냥 보이는 게 좋아서',
    sessions: [{ date: '2026-06-07', startTime: '18:00', venue: 'LCI Art Hall', city: '서울' }] },

  { id: 'greenplugged', kind: 'FESTIVAL', primaryName: '그린플러그드 서울 2026',
    secondaryTitle: null,
    sessions: [
      { date: '2026-06-12', startTime: '17:00', venue: '난지한강공원', city: '서울' },
      { date: '2026-06-13', startTime: '13:00', venue: '난지한강공원', city: '서울' },
      { date: '2026-06-14', startTime: '13:00', venue: '난지한강공원', city: '서울' },
    ] },

  { id: 'silica', kind: 'SHOW', primaryName: '실리카겔',
    secondaryTitle: 'LIQUID SUNSHINE TOUR',
    sessions: [
      { date: '2026-06-14', startTime: '19:00', venue: '무신사 개러지', city: '서울' },
      { date: '2026-07-05', startTime: '19:00', venue: '인스파이어 아레나', city: '인천' },
      { date: '2026-07-19', startTime: '19:00', venue: 'KBS 부산홀', city: '부산' },
    ] },

  { id: 'saesonyeon', kind: 'SHOW', primaryName: '새소년',
    secondaryTitle: '비적응의 밤',
    sessions: [{ date: '2026-06-21', startTime: '18:00', venue: '롤링홀', city: '서울' }] },

  { id: 'jambinai', kind: 'SHOW', primaryName: '잠비나이',
    secondaryTitle: 'ONDA — 새 앨범 발매 기념',
    sessions: [{ date: '2026-06-27', startTime: '20:00', venue: '벨로주 홍대', city: '서울' }] },

  { id: 'saebyeok', kind: 'SHOW', primaryName: '새벽과 새',
    secondaryTitle: '한여름 단독',
    sessions: [{ date: '2026-06-30', startTime: '20:00', venue: '클럽FF', city: '서울' }] },
];

// ─── date helpers (vanilla) ──────────────────────────────────────────────────
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABEL = (d) => `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}`;

function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function sameYMD(a, b) { return ymd(a) === ymd(b); }
function addDays(d, n) { const x = new Date(d); x.setDate(d.getDate() + n); return x; }
function diffDays(a, b) {
  const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfMonthGrid(d) {
  const first = startOfMonth(d);
  return addDays(first, -first.getDay()); // sunday-start
}
function monthCells(d) {
  const start = startOfMonthGrid(d);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  const monthIdx = d.getMonth();
  // trim trailing empty week if last row has no days from this month
  while (cells.length > 35 && cells[cells.length - 1].getMonth() !== monthIdx
         && cells[cells.length - 7].getMonth() !== monthIdx) {
    cells.splice(cells.length - 7, 7);
  }
  return cells;
}

// Group sessions into "blocks":
// - Consecutive same-venue days = one block (festival)
// - Non-consecutive sessions = separate blocks (tour) labeled "i/total"
function eventBlocks(ev) {
  const sorted = [...ev.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const blocks = [];
  for (const s of sorted) {
    const last = blocks[blocks.length - 1];
    if (last) {
      const lastEnd = parseYMD(last.sessions[last.sessions.length - 1].date);
      const next = parseYMD(s.date);
      if (diffDays(lastEnd, next) === 1 && s.venue === last.sessions[0].venue) {
        last.sessions.push(s);
        continue;
      }
    }
    blocks.push({ sessions: [s] });
  }
  const total = blocks.length;
  return blocks.map((b, i) => ({
    ...b,
    event: ev,
    start: parseYMD(b.sessions[0].date),
    end: parseYMD(b.sessions[b.sessions.length - 1].date),
    span: b.sessions.length,
    seq: total > 1 ? { i: i + 1, total } : null,
  }));
}
const ALL_BLOCKS = EVENTS.flatMap(eventBlocks);

// Cut a block to a given week's 7 cells; returns { startCol, span } or null.
function blockInWeek(block, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  if (block.end < weekStart || block.start > weekEnd) return null;
  const startCol = Math.max(0, diffDays(weekStart, block.start));
  const endCol = Math.min(6, diffDays(weekStart, block.end));
  return { startCol, span: endCol - startCol + 1,
    leftClipped: block.start < weekStart,
    rightClipped: block.end > weekEnd };
}

// Greedy lane assignment within a week (so bars stack without overlap).
function assignLanes(weekBlocks) {
  const lanes = [];
  return weekBlocks
    .sort((a, b) => a.seg.startCol - b.seg.startCol || (b.seg.span - a.seg.span))
    .map((wb) => {
      const { startCol, span } = wb.seg;
      const endCol = startCol + span - 1;
      let laneIdx = 0;
      while (true) {
        const lane = lanes[laneIdx];
        if (!lane) { lanes.push([{ startCol, endCol }]); break; }
        const conflict = lane.some(r => !(endCol < r.startCol || startCol > r.endCol));
        if (!conflict) { lane.push({ startCol, endCol }); break; }
        laneIdx++;
      }
      return { ...wb, lane: laneIdx };
    });
}

// ─── shared placeholders (replace with real components in prod) ──────────────
function HomeHeaderPlaceholder() {
  return (
    <div className="relative w-full flex items-center justify-between px-6"
         style={{ height: 72,
                  background: 'rgba(255,255,255,0.015)',
                  boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)' }}>
      <span className="text-[10px] tracking-[0.3em] uppercase text-paper/30">‹HomeHeader / 72›</span>
      <span className="text-[10px] tracking-[0.3em] uppercase text-paper/20">placeholder</span>
    </div>
  );
}
function BackLinkPlaceholder() {
  return (
    <div className="inline-flex items-center gap-3 px-3 h-7 text-[11px] tracking-[0.18em] uppercase text-paper/45"
         style={{ background: 'rgba(255,255,255,0.015)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
      <span>← 검색으로</span>
      <span className="text-paper/20">‹BackLink›</span>
    </div>
  );
}

// ─── Month grid ──────────────────────────────────────────────────────────────
function MonthGridCalendar({ month }) {
  const cells = monthCells(month);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const LANE_H = 22;
  const LANE_GAP = 4;
  const CELL_H = 132;
  const HEADER_H = 26;
  const MAX_VISIBLE_LANES = 3;

  return (
    <div className="w-full">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 hairline-t hairline-b">
        {DOW_KR.map((dow, i) => (
          <div key={dow}
               className={'h-9 flex items-center px-3 text-[10px] tracking-[0.3em] uppercase ' +
                          (i === 0 || i === 6 ? 'text-paper/55' : 'text-paper/35')}
               style={{ boxShadow: i < 6 ? 'inset -1px 0 0 rgba(255,255,255,0.06)' : 'none' }}>
            {dow}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {rows.map((row, ri) => {
        const weekStart = row[0];
        const segs = [];
        for (const b of ALL_BLOCKS) {
          const seg = blockInWeek(b, weekStart);
          if (seg) segs.push({ block: b, seg });
        }
        const laneAssignments = assignLanes(segs);
        const overflowByCol = Array(7).fill(0);
        const visible = laneAssignments.filter(w => {
          if (w.lane < MAX_VISIBLE_LANES) return true;
          for (let c = w.seg.startCol; c < w.seg.startCol + w.seg.span; c++) overflowByCol[c]++;
          return false;
        });

        return (
          <div key={ri} className="relative grid grid-cols-7"
               style={{ minHeight: CELL_H, boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)' }}>
            {row.map((d, ci) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameYMD(d, TODAY);
              const isPast = d < new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
              const isWeekend = ci === 0 || ci === 6;
              return (
                <div key={ci} className="relative px-3 pt-2.5 pb-2"
                     style={{
                       boxShadow: ci < 6 ? 'inset -1px 0 0 rgba(255,255,255,0.06)' : 'none',
                       opacity: inMonth ? 1 : 0.35,
                     }}>
                  <div className="flex items-center gap-1.5">
                    <span className={
                      'text-[13px] tabular-nums tracking-tight ' +
                      (isPast && inMonth
                        ? 'text-paper/30'
                        : isWeekend ? 'text-paper/90' : 'text-paper/70')
                    }>
                      {d.getDate()}
                    </span>
                    {isToday && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime"
                            style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}></span>
                    )}
                    {d.getDate() === 1 && (
                      <span className="text-[9px] tracking-[0.22em] uppercase text-paper/30 ml-0.5">
                        {d.getMonth() + 1}월
                      </span>
                    )}
                  </div>
                  {overflowByCol[ci] > 0 && (
                    <div className="absolute left-3 right-3 text-[10px] tracking-[0.05em] text-paper/45 hover:text-paper transition cursor-pointer"
                         style={{ bottom: 6 }}>
                      + {overflowByCol[ci]}건 더보기
                    </div>
                  )}
                </div>
              );
            })}

            {/* Event bars — absolutely positioned over the row */}
            {visible.map((w, i) => {
              const { block, seg, lane } = w;
              const ev = block.event;
              const left = (seg.startCol / 7) * 100;
              const width = (seg.span / 7) * 100;
              const top = HEADER_H + lane * (LANE_H + LANE_GAP);
              const isFestival = ev.kind === 'FESTIVAL';
              const isMultiDay = block.span > 1;
              return (
                <div key={i} className="absolute group cursor-pointer"
                     style={{ left: `calc(${left}% + 6px)`, width: `calc(${width}% - 12px)`, top, height: LANE_H }}>
                  <div className={
                    'h-full w-full px-2 flex items-center gap-1.5 transition ' +
                    (isFestival
                      ? 'text-paper border border-paper/40 group-hover:border-paper/80 bg-black/20'
                      : 'text-paper bg-white/[0.08] group-hover:bg-white/[0.14]')
                  } style={{
                    borderTopLeftRadius: seg.leftClipped ? 0 : 3,
                    borderBottomLeftRadius: seg.leftClipped ? 0 : 3,
                    borderTopRightRadius: seg.rightClipped ? 0 : 3,
                    borderBottomRightRadius: seg.rightClipped ? 0 : 3,
                  }}>
                    <span className={'inline-block w-1 h-1 shrink-0 ' +
                      (isFestival ? 'bg-paper/80' : 'bg-paper/60')}
                          style={{ borderRadius: 1 }}></span>
                    <span className="text-[11px] font-medium leading-none truncate">
                      {ev.primaryName}
                    </span>
                    {isMultiDay && !seg.leftClipped && (
                      <span className="text-[9px] tracking-[0.12em] uppercase text-paper/55 leading-none shrink-0">
                        {block.span}일
                      </span>
                    )}
                    {block.seq && !seg.leftClipped && (
                      <span className="text-[9px] tracking-[0.12em] uppercase text-paper/55 leading-none shrink-0">
                        {block.seq.i}/{block.seq.total}
                      </span>
                    )}
                    {seg.leftClipped && (
                      <span className="text-[9px] tracking-[0.12em] uppercase text-paper/40 leading-none shrink-0">
                        ...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Month nav ───────────────────────────────────────────────────────────────
function MonthNav({ month, label, sub }) {
  return (
    <div className="flex items-end justify-between hairline-b pb-5">
      <div>
        <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-2">
          {label}
        </div>
        <div className="flex items-baseline gap-5 whitespace-nowrap">
          <h1 className="logo-headliner text-paper text-[64px] leading-none">
            {MONTH_LABEL(month)}
          </h1>
          <span className="text-[13px] tracking-[0.18em] uppercase text-paper/45">
            {sub}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 border border-white/10 hover:border-white/30 transition flex items-center justify-center text-paper/70 hover:text-paper" aria-label="이전 달">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 6l-6 6 6 6"/></svg>
        </button>
        <button className="w-9 h-9 border border-white/10 hover:border-white/30 transition flex items-center justify-center text-paper/70 hover:text-paper" aria-label="다음 달">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 6l6 6-6 6"/></svg>
        </button>
        <div className="ml-3 inline-flex" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
          {['6월', '7월', '8월', '9월'].map((m, i) => (
            <button key={m}
                    className={'h-9 px-3 text-[11px] tracking-[0.18em] uppercase transition ' +
                      (i === month.getMonth() - 5 ? 'bg-paper text-ink-900' : 'text-paper/55 hover:text-paper')}>
              {m}
            </button>
          ))}
        </div>
        <button className="ml-2 h-9 px-3 text-[11px] tracking-[0.18em] uppercase text-paper/70 hover:text-paper transition"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
          오늘
        </button>
      </div>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────
function CalendarPage() {
  const month = new Date(2026, 5, 1); // June 2026
  return (
    <div className="bg-ink-900 text-paper min-h-screen"
         style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      <HomeHeaderPlaceholder />
      <div className="max-w-[1320px] mx-auto px-10 pt-8 pb-16">
        <BackLinkPlaceholder />
        <div className="mt-8">
          <MonthNav month={month}
                    label="공연 캘린더 / UPCOMING"
                    sub="이번 달 6건" />
          {/* summary strip */}
          <div className="grid grid-cols-4 gap-px mt-6 mb-8"
               style={{ background: 'rgba(255,255,255,0.06)' }}>
            {[
              { k: '총 이벤트', v: '6', sub: '6월' },
              { k: '단독공연', v: '5', sub: 'SHOW' },
              { k: '페스티벌', v: '1', sub: 'FESTIVAL' },
              { k: '주말 공연', v: '4', sub: '금·토·일' },
            ].map((s, i) => (
              <div key={i} className="bg-ink-900 px-5 py-4">
                <div className="text-[10px] tracking-[0.3em] uppercase text-paper/40">{s.k}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="logo-headliner text-paper text-[32px] leading-none">{s.v}</span>
                  <span className="text-[11px] tracking-[0.18em] uppercase text-paper/40">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
          <MonthGridCalendar month={month} />

          {/* legend */}
          <div className="mt-8 flex flex-wrap items-center gap-6 text-[10px] tracking-[0.22em] uppercase text-paper/45">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block px-1.5 py-0.5 bg-white/[0.08] text-paper text-[9px]"
                    style={{ borderRadius: 2 }}>SHOW</span>
              단독공연
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block px-1.5 py-0.5 border border-paper/40 text-paper text-[9px]"
                    style={{ borderRadius: 2 }}>FEST</span>
              페스티벌 — 다일 가로 span
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-[9px] tracking-[0.12em] uppercase text-paper/55 px-1.5 py-0.5"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)', borderRadius: 2 }}>1/3</span>
              투어 (도시 N개)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime"
                    style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}></span>
              오늘
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CalendarPage />);
