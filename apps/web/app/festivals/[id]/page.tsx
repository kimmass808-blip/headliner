/**
 * Headliner — Festival 상세 페이지 (다크 무드).
 * Show 상세와 동일한 레이아웃 패턴 — 다른 점은 라인업 섹션과 날짜 범위.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { ScrapButton } from '../../../components/common/ScrapButton';
import { PosterColumn } from '../../../components/show/PosterColumn';
import { FestivalInfoColumn } from '../../../components/festival/InfoColumn';
import {
  LineupSection,
  type LineupDayData,
  type LineupChipData,
} from '../../../components/common/LineupSection';
import { FestivalInfoSection } from '../../../components/festival/FestivalInfoSection';
import { ymd } from '../../../lib/calendar';
import { formatTicketOpen } from '../../../lib/ticketOpen';
import { ticketVendorFromUrl } from '@mft/shared';

export const revalidate = 86400; // 1일. 관리자 수정 시 actions.ts가 즉시 무효화.
// 동적 세그먼트의 런타임 ISR 활성화: 빌드 시엔 아무 경로도 프리렌더하지 않고,
// 첫 방문 때 렌더 후 revalidate(1시간) 동안 풀 라우트 캐시에 저장(이후 캐시 HIT).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

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
        where: { status: 'APPROVED', duplicateOfShowId: null }, // v7
        include: {
          artists: { select: { id: true, canonicalName: true } },
        },
        orderBy: [{ firstSessionDate: 'asc' }, { setOrder: 'asc' }],
      },
      infoPosts: {
        where: { status: 'APPROVED' },
        orderBy: [{ category: 'asc' }, { order: 'asc' }, { postedAt: 'asc' }],
      },
    },
  });

  if (!festival || festival.status !== 'APPROVED') notFound(); // v7: PENDING/REJECTED은 사이트에서 미노출

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

  // 라인업 — 칩 기반 데이별 그룹. day 순서는 firstSessionDate 오름차순.
  // 각 day 안에서 setOrder 순으로 아티스트 수집, 같은 day 내 중복 이름은 첫 발견만.
  const dayGroups = new Map<string, { date: Date; chips: LineupChipData[] }>();
  for (const show of festival.shows) {
    if (!show.firstSessionDate) continue;
    const date = new Date(show.firstSessionDate);
    const key = ymd(date);
    if (!dayGroups.has(key)) dayGroups.set(key, { date, chips: [] });
    const group = dayGroups.get(key)!;
    for (const artist of show.artists) {
      if (group.chips.some((c) => c.name === artist.canonicalName)) continue;
      group.chips.push({ name: artist.canonicalName, showId: show.id });
    }
  }
  const dayKeys = Array.from(dayGroups.keys()).sort();
  const lineupDays: LineupDayData[] = dayKeys.map((k, i) => {
    const g = dayGroups.get(k)!;
    return {
      label: `DAY ${i + 1}`,
      date: `${g.date.getFullYear()}.${String(g.date.getMonth() + 1).padStart(2, '0')}.${String(g.date.getDate()).padStart(2, '0')}`,
      dayKr: WEEKDAY_EN[g.date.getDay()]!,
      chips: g.chips,
    };
  });
  const lineupTotal = new Set<string>();
  for (const g of dayGroups.values()) {
    for (const c of g.chips) lineupTotal.add(c.name);
  }

  const venueName = festival.locationText ?? festival.venue?.name ?? null;
  const city = festival.venue?.region ?? null;

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />

      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="flex items-center justify-between gap-3">
            <BackLink />
            <ScrapButton kind="festival" id={festival.id} />
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-16">
            <PosterColumn imageUrl={festival.posterImageUrl} alt={festival.name} />
            <FestivalInfoColumn
              name={festival.name}
              dateText={dateText}
              startMonthDay={startMonthDay}
              dayBadge={dayBadge}
              dayKrRange={dayKrRange}
              venueName={venueName}
              city={city}
              ticketUrl={festival.ticketUrl}
              ticketLabel={festival.ticketUrl ? (ticketVendorFromUrl(festival.ticketUrl) ?? '예매 페이지') : null}
              ticketOpenLabel={formatTicketOpen(festival.ticketOpenAt)}
              officialUrl={festival.officialUrl}
            />
          </div>
        </section>

        <LineupSection totalArtists={lineupTotal.size} days={lineupDays} />

        {festival.infoPosts.length ? (
          <FestivalInfoSection
            posts={festival.infoPosts.map((p) => ({
              id: p.id,
              category: p.category,
              title: p.title,
              imageUrls: p.imageUrls,
            }))}
          />
        ) : null}
      </main>
    </div>
  );
}
