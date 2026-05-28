/**
 * Headliner — Show 상세 페이지 (다크 무드 / design_handoff_headliner_pages 기준).
 */

import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { PosterColumn } from '../../../components/show/PosterColumn';
import { InfoColumn } from '../../../components/show/InfoColumn';
import { SetlistSection } from '../../../components/show/SetlistSection';
import type { SongRowData } from '../../../components/show/SongRow';
import {
  LineupSection,
  type LineupDayData,
  type LineupChipData,
} from '../../../components/common/LineupSection';
import { ymd } from '../../../lib/calendar';

export const dynamic = 'force-dynamic';

const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAY_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

/** 외부 URL host를 사람이 읽기 좋은 라벨로 ('yes24.com' → 'YES24 티켓') */
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

/** instagram.com/p/SHORTCODE → '@sourceAccount' (InstagramPost row가 있으면 사용) */
function deriveSourceLabel(account: string | null): string | null {
  if (!account) return null;
  return account.startsWith('@') ? account : `@${account}`;
}

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      venue: true,
      artists: { select: { id: true, canonicalName: true } },
      festival: { select: { id: true, name: true } },
      setlist: { include: { songs: { orderBy: { order: 'asc' } } } },
      sessions: { orderBy: { date: 'asc' } },
    },
  });

  if (!show) notFound();

  // InstagramPost에서 sourceAccount 조회 (있으면 sourceLabel에 사용)
  const igPost = await prisma.instagramPost.findUnique({
    where: { canonicalUrl: show.originalPostUrl },
    select: { sourceAccount: true },
  });

  // 페스티벌 소속이면 같은 페스티벌의 라인업 fetch (chip 기반 LineupSection용)
  const festivalLineupShows = show.festivalId
    ? await prisma.show.findMany({
        where: { festivalId: show.festivalId, duplicateOfShowId: null },
        include: { artists: { select: { id: true, canonicalName: true } } },
        orderBy: [{ firstSessionDate: 'asc' }, { setOrder: 'asc' }],
      })
    : [];

  // 라인업 데이터 준비 — day별 그룹 + dedup + isHere 마킹
  let lineupTotalArtists = 0;
  let lineupDays: LineupDayData[] = [];
  if (festivalLineupShows.length > 0) {
    const dayGroups = new Map<string, { date: Date; chips: LineupChipData[] }>();
    for (const fs of festivalLineupShows) {
      if (!fs.firstSessionDate) continue;
      const date = new Date(fs.firstSessionDate);
      const key = ymd(date);
      if (!dayGroups.has(key)) dayGroups.set(key, { date, chips: [] });
      const group = dayGroups.get(key)!;
      for (const artist of fs.artists) {
        if (group.chips.some((c) => c.name === artist.canonicalName)) continue;
        group.chips.push({
          name: artist.canonicalName,
          showId: fs.id,
          isHere: fs.id === show.id,
        });
      }
    }
    const dayKeys = Array.from(dayGroups.keys()).sort();
    lineupDays = dayKeys.map((k, i) => {
      const g = dayGroups.get(k)!;
      const hereChip = g.chips.find((c) => c.isHere);
      return {
        label: `DAY ${i + 1}`,
        date: `${g.date.getFullYear()}.${String(g.date.getMonth() + 1).padStart(2, '0')}.${String(g.date.getDate()).padStart(2, '0')}`,
        dayKr: WEEKDAY_EN[g.date.getDay()]!,
        hereArtist: hereChip?.name,
        chips: g.chips,
      };
    });
    const uniq = new Set<string>();
    for (const g of dayGroups.values()) {
      for (const c of g.chips) uniq.add(c.name);
    }
    lineupTotalArtists = uniq.size;
  }

  // v6: ShowSession is the canonical source. Phase 1 backfill guarantees every
  // dated Show has ≥1 session row; ingest always writes both. Legacy Show.date
  // remains as a Phase 6 cleanup target — do not read it here.
  const sessions = show.sessions.map((s) => {
    const d = new Date(s.date);
    return {
      date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
      monthDay: [
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ] as [string, string],
      dayShort: WEEKDAY_EN[d.getDay()]!,
      dayKr: WEEKDAY_KR[d.getDay()]!,
      startTime: s.startTime,
      ticketUrl: s.ticketUrl,
      ticketLabel: s.ticketUrl ? deriveTicketLabel(s.ticketUrl) : null,
    };
  });

  // Poster column 캡션용 날짜 라벨 — single / multi-day range
  const posterDateLabel = sessions.length === 0
    ? null
    : sessions.length === 1
      ? sessions[0]!.date
      : `${sessions[0]!.date} – ${sessions[sessions.length - 1]!.date}`;

  // 셋리스트 → 본편/앙코르 분리 + 각각 1부터 재번호
  const songs: SongRowData[] = show.setlist
    ? (() => {
        const all = show.setlist.songs; // 이미 order asc 정렬됨
        const main = all.filter((s) => !s.isEncore);
        const encore = all.filter((s) => s.isEncore);
        return [
          ...main.map((s, i) => ({ n: i + 1, title: s.title, cover: s.coverOf, encore: false })),
          ...encore.map((s, i) => ({ n: i + 1, title: s.title, cover: s.coverOf, encore: true })),
        ];
      })()
    : [];

  const artistsAlt = show.artists.map((a) => a.canonicalName).join(', ');
  const posterAlt = `${artistsAlt}${show.title ? ` — ${show.title}` : ''}`;

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
              imageUrl={show.imageUrl}
              alt={posterAlt}
              dateLabel={posterDateLabel}
            />
            <InfoColumn
              artists={show.artists}
              title={show.title}
              sessions={sessions}
              venueName={show.venue?.name ?? null}
              city={show.venue?.region ?? null}
              sourceUrl={show.originalPostUrl}
              sourceLabel={deriveSourceLabel(igPost?.sourceAccount ?? null)}
              festival={
                show.festival
                  ? { id: show.festival.id, name: show.festival.name, stage: show.stage }
                  : null
              }
              missing={show.missingFields}
            />
          </div>
        </section>

        {show.festivalId && lineupDays.length > 0 ? (
          <LineupSection
            totalArtists={lineupTotalArtists}
            days={lineupDays}
            festivalLinkHref={`/festivals/${show.festivalId}`}
          />
        ) : (
          <SetlistSection songs={songs} />
        )}
      </main>
    </div>
  );
}
