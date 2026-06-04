/**
 * 모바일 세로 아젠다 — 좁은 폭에서 월 그리드가 깨지고 글자가 잘리는 문제 대응.
 * 핸드오프 calendar-mobile.jsx(Option B) 기준. MonthGrid와 동일한 events 데이터를
 * 재사용하며, 표시 월에 "시작"하는 블록만 시작일별로 묶어 세로로 나열한다.
 */

import Link from 'next/link';
import {
  DOW_KR,
  eventBlocks,
  sameYMD,
  type CalendarEvent,
  type EventBlock,
} from '../../lib/calendar';

export interface MonthAgendaProps {
  month: Date;
  events: CalendarEvent[];
  today: Date;
}

const DD = (d: Date) => String(d.getDate()).padStart(2, '0');
const MM = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');

interface DateGroup {
  date: Date;
  blocks: EventBlock[];
}

/** 표시 월에 시작하는 블록을 시작일별로 그룹. */
function monthAgenda(month: Date, events: CalendarEvent[]): DateGroup[] {
  const blocks = events
    .flatMap(eventBlocks)
    .filter(
      (b) =>
        b.start.getFullYear() === month.getFullYear() &&
        b.start.getMonth() === month.getMonth(),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const groups: DateGroup[] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (!last || !sameYMD(last.date, b.start)) {
      groups.push({ date: b.start, blocks: [b] });
    } else {
      last.blocks.push(b);
    }
  }
  return groups;
}

// ─── 이벤트 카드 ──────────────────────────────────────────────────────────────
function AgendaCard({ block }: { block: EventBlock }) {
  const ev = block.event;
  const isFestival = ev.kind === 'FESTIVAL';
  const isMulti = block.span > 1;
  const first = block.sessions[0]!;
  const href = isFestival ? `/festivals/${ev.id}` : `/shows/${ev.id}`;

  return (
    <Link
      href={href}
      className="block rounded-md px-4 py-4 transition active:bg-white/[0.04]"
      style={{ background: '#141414', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
    >
      {/* badge + qualifier row */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span
          className={
            'rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-[0.22em] ' +
            (isFestival
              ? 'border border-paper/70 font-semibold text-paper'
              : 'bg-white/10 text-paper/90')
          }
        >
          {ev.kind}
        </span>
        {isMulti ? (
          <span className="text-[10px] uppercase tracking-[0.18em] tabular-nums text-paper/50">
            {MM(block.start)}.{DD(block.start)}–{MM(block.end)}.{DD(block.end)} · 총 {block.span}일
          </span>
        ) : null}
        {block.seq ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-paper/50">
            투어 {block.seq.i}/{block.seq.total}
          </span>
        ) : null}
      </div>

      {/* name */}
      <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-paper">
        {ev.primaryName}
      </h3>
      {ev.secondaryTitle ? (
        <p className="mt-1 text-[13px] leading-snug text-paper/55">{ev.secondaryTitle}</p>
      ) : null}

      {/* venue + time */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] text-paper/70">
          {first.city ? (
            <>
              {first.city} <span className="text-paper/30">·</span>{' '}
            </>
          ) : null}
          {first.venue}
        </span>
        {first.startTime ? (
          <span className="shrink-0 text-[12px] tabular-nums text-paper/50">
            {isMulti ? `${first.startTime}~` : `${first.startTime} 시작`}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

// ─── 날짜 그룹: 좌측 날짜 레일 + 카드 스택 ────────────────────────────────────
function AgendaGroup({ group, today }: { group: DateGroup; today: Date }) {
  const d = group.date;
  const isToday = sameYMD(d, today);
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast = d < todayDateOnly;
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;

  return (
    <div className="flex gap-3.5" style={{ opacity: isPast ? 0.45 : 1 }}>
      {/* date rail */}
      <div className="flex shrink-0 flex-col items-center" style={{ width: 44 }}>
        <span className="logo-headliner leading-none text-paper" style={{ fontSize: 30 }}>
          {DD(d)}
        </span>
        <span
          className={
            'mt-1 text-[10px] uppercase tracking-[0.16em] ' +
            (isWeekend ? 'text-paper/75' : 'text-paper/40')
          }
        >
          {DOW_KR[dow]}
        </span>
        {isToday ? (
          <span
            className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-paper"
            style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}
          />
        ) : null}
      </div>
      {/* cards */}
      <div className="min-w-0 flex-1 space-y-2.5">
        {group.blocks.map((b, i) => (
          <AgendaCard key={`${b.event.id}-${i}`} block={b} />
        ))}
      </div>
    </div>
  );
}

export function MonthAgenda({ month, events, today }: MonthAgendaProps) {
  const groups = monthAgenda(month, events);

  if (groups.length === 0) {
    return (
      <div className="mt-8 py-16 text-center text-[13px] tracking-[0.06em] text-paper/40">
        이번 달 공연이 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {groups.map((g, i) => (
        <AgendaGroup key={i} group={g} today={today} />
      ))}
    </div>
  );
}
