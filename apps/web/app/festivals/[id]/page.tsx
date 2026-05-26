/**
 * Headliner — Festival 상세 페이지 (다크 무드).
 * Show 상세와 동일한 레이아웃 패턴 — 다른 점은 라인업 섹션과 날짜 범위.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { PosterColumn } from '../../../components/show/PosterColumn';
import { FestivalInfoColumn } from '../../../components/festival/InfoColumn';
import {
  LineupSection,
  type LineupShow,
} from '../../../components/festival/LineupSection';

export const dynamic = 'force-dynamic';

const WEEKDAY_KR_FULL = [
  '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일',
] as const;
const WEEKDAY_KR_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;
const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function fmt(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function deriveTicketLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('yes24')) return 'YES24 티켓';
    if (host.includes('interpark')) return '인터파크 티켓';
    if (host.includes('melon')) return '멜론 티켓';
    if (host.includes('ticketlink')) return '티켓링크';
    return '예매 페이지';
  } catch {
    return '예매 페이지';
  }
}

export default async function FestivalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const festival = await prisma.festival.findUnique({
    where: { id },
    include: {
      venue: true,
      shows: {
        include: {
          artists: { select: { id: true, canonicalName: true } },
          setlist: { select: { id: true } },
          // v6: festival appearances are single-day; first session carries
          // the per-day start time.
          sessions: { orderBy: { date: 'asc' }, take: 1 },
        },
        orderBy: [{ firstSessionDate: 'asc' }, { stage: 'asc' }, { setOrder: 'asc' }],
      },
    },
  });

  if (!festival) notFound();

  // 날짜 텍스트·키커
  const startDate = festival.startDate ? new Date(festival.startDate) : null;
  const endDate = festival.endDate ? new Date(festival.endDate) : null;
  const isMultiDay = startDate && endDate && endDate.getTime() !== startDate.getTime();

  const dateText = (() => {
    if (!startDate) return null;
    if (isMultiDay && endDate) return `${fmt(startDate)} ~ ${fmtMd(endDate)}`;
    return fmt(startDate);
  })();

  const startMonthDay: [string, string] | null = startDate
    ? [String(startDate.getMonth() + 1).padStart(2, '0'), String(startDate.getDate()).padStart(2, '0')]
    : null;

  const dayBadge = (() => {
    if (!startDate) return null;
    if (isMultiDay && endDate) {
      const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${diff} DAYS`;
    }
    return WEEKDAY_EN[startDate.getDay()];
  })();

  const dayKrRange = (() => {
    if (!startDate) return null;
    if (isMultiDay && endDate) {
      return `${WEEKDAY_KR_SHORT[startDate.getDay()]}~${WEEKDAY_KR_SHORT[endDate.getDay()]}`;
    }
    return WEEKDAY_KR_FULL[startDate.getDay()];
  })();

  // 라인업 — day → stage → shows로 그룹.
  // v6: group by firstSessionDate (denormalized) and pull startTime from sessions[0].
  const dayMap = new Map<string, Map<string, LineupShow[]>>();
  for (const show of festival.shows) {
    const dayKey = show.firstSessionDate
      ? new Date(show.firstSessionDate).toISOString().slice(0, 10)
      : 'unknown';
    const stageKey = show.stage ?? '(스테이지 미정)';
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
    const stages = dayMap.get(dayKey)!;
    if (!stages.has(stageKey)) stages.set(stageKey, []);
    stages.get(stageKey)!.push({
      id: show.id,
      startTime: show.sessions[0]?.startTime ?? null,
      stage: show.stage,
      artists: show.artists,
      hasSetlist: Boolean(show.setlist),
    });
  }

  const venueName = festival.locationText ?? festival.venue?.name ?? null;
  const city = festival.venue?.region ?? null;

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />

      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <BackLink />
        </section>

        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-16">
            <PosterColumn
              imageUrl={festival.posterImageUrl}
              alt={festival.name}
              dateLabel={dateText}
            />
            <FestivalInfoColumn
              name={festival.name}
              dateText={dateText}
              startMonthDay={startMonthDay}
              dayBadge={dayBadge}
              dayKrRange={dayKrRange}
              venueName={venueName}
              city={city}
              ticketUrl={festival.ticketUrl}
              ticketLabel={festival.ticketUrl ? deriveTicketLabel(festival.ticketUrl) : null}
              officialUrl={festival.officialUrl}
              description={festival.description}
            />
          </div>
        </section>

        <LineupSection dayMap={dayMap} totalShows={festival.shows.length} />
      </main>
    </div>
  );
}
