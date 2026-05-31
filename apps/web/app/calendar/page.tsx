/**
 * Headliner — 공연 캘린더 페이지 (`/calendar`).
 *
 * 다크 무드 / Option A · 월 그리드.
 * `?month=YYYY-MM` 으로 표시 월 제어 (없으면 TODAY가 속한 달).
 */

import { unstable_cache } from 'next/cache';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../components/home/Header';
import { BackLink } from '../../components/common/BackLink';
import { MonthNav } from '../../components/calendar/MonthNav';
import { SummaryStrip } from '../../components/calendar/SummaryStrip';
import { MonthGrid } from '../../components/calendar/MonthGrid';
import { CalendarLegend } from '../../components/calendar/CalendarLegend';
import {
  parseMonthParam,
  monthCells,
  ymd,
  summarizeMonth,
  startOfMonth,
  addDays,
  type CalendarEvent,
  type CalendarSession,
} from '../../lib/calendar';

export const dynamic = 'force-dynamic';

interface SearchParams {
  month?: string;
}

/**
 * 표시 월의 grid 범위에 걸치는 세션/페스티벌 조회.
 * 페이지는 ?month searchParams로 동적이지만, 범위별 조회 결과는 요청 간 캐시.
 * range 경계는 월별로 고정 → 월 단위 캐시 키.
 */
const getCalendarData = unstable_cache(
  async (rangeStartMs: number, rangeEndMs: number) => {
    const rangeStart = new Date(rangeStartMs);
    const rangeEnd = new Date(rangeEndMs);
    return Promise.all([
      prisma.showSession.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          show: { status: 'APPROVED', duplicateOfShowId: null, festivalId: null }, // v7
        },
        include: {
          show: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              artists: { select: { id: true, canonicalName: true } },
              venue: { select: { name: true, region: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.festival.findMany({
        where: {
          status: 'APPROVED', // v7
          AND: [
            { OR: [{ startDate: { lte: rangeEnd } }, { startDate: null }] },
            { OR: [{ endDate: { gte: rangeStart } }, { endDate: null }] },
          ],
          startDate: { not: null },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          locationText: true,
          posterImageUrl: true,
          venue: { select: { name: true, region: true } },
        },
      }),
    ]);
  },
  ['calendar-month-v1'],
  { revalidate: 86400, tags: ['calendar', 'shows', 'festivals'] }, // 관리자 수정 시 태그로 즉시 무효화
);

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = new Date();
  const month = parseMonthParam(params.month) ?? startOfMonth(today);

  // 표시되는 grid 전체 범위 (월 가장자리 + adjacent days)
  const cells = monthCells(month);
  const rangeStart = cells[0]!;
  const rangeEnd = cells[cells.length - 1]!;

  // Show: 해당 범위에 세션이 있는 standalone 공연
  // Festival: 해당 범위와 겹치는 페스티벌 row
  const [sessions, festivals] = await getCalendarData(
    rangeStart.getTime(),
    rangeEnd.getTime(),
  );

  // 세션 → 쇼별로 그룹 → CalendarEvent
  const showMap = new Map<string, CalendarEvent>();
  for (const s of sessions) {
    const showId = s.show.id;
    let ev = showMap.get(showId);
    if (!ev) {
      const primaryArtist = s.show.artists[0]?.canonicalName ?? s.show.title ?? '공연';
      ev = {
        id: showId,
        kind: 'SHOW',
        primaryName: primaryArtist,
        secondaryTitle: s.show.title ?? null,
        poster: s.show.imageUrl,
        sessions: [],
      };
      showMap.set(showId, ev);
    }
    const session: CalendarSession = {
      date: ymd(new Date(s.date)),
      startTime: s.startTime,
      venue: s.show.venue?.name ?? '미정',
      city: s.show.venue?.region ?? null,
    };
    ev.sessions.push(session);
  }
  const showEvents = Array.from(showMap.values());

  // 페스티벌 → CalendarEvent (startDate..endDate를 일자별 세션으로 전개)
  const festivalEvents: CalendarEvent[] = festivals
    .filter((f) => f.startDate)
    .map((f) => {
      const start = new Date(f.startDate!);
      const end = f.endDate ? new Date(f.endDate) : start;
      const days: CalendarSession[] = [];
      const venueName = f.locationText ?? f.venue?.name ?? '미정';
      const city = f.venue?.region ?? null;
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        days.push({
          date: ymd(d),
          startTime: null,
          venue: venueName,
          city,
        });
      }
      return {
        id: f.id,
        kind: 'FESTIVAL' as const,
        primaryName: f.name,
        secondaryTitle: null,
        poster: f.posterImageUrl,
        sessions: days,
      };
    });

  const events: CalendarEvent[] = [...showEvents, ...festivalEvents];

  // 요약 통계 (현재 월 기준)
  const summary = summarizeMonth(events, month);

  // jump 후보 — 오늘 기준 현재월 + 다음 3달
  const todayMonth = startOfMonth(today);
  const jumpMonths = [
    todayMonth,
    startOfMonth(addDays(todayMonth, 32)),
    startOfMonth(addDays(todayMonth, 65)),
    startOfMonth(addDays(todayMonth, 95)),
  ];

  const monthLabel = `${month.getMonth() + 1}월`;
  const subLabel = summary.total === 0
    ? '이번 달 0건'
    : `이번 달 ${summary.total}건`;

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-[1320px] px-6 pb-16 pt-8 sm:px-10">
        <BackLink />
        <div className="mt-8">
          <MonthNav
            month={month}
            label="공연 캘린더 / UPCOMING"
            sub={subLabel}
            jumpMonths={jumpMonths}
            todayMonth={todayMonth}
          />
          <SummaryStrip summary={summary} monthLabel={monthLabel} />
          <MonthGrid month={month} events={events} today={today} />
          <CalendarLegend />
        </div>
      </main>
    </div>
  );
}
