/**
 * Headliner — Show 상세 페이지 (다크 무드 / design_handoff_headliner_pages 기준).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { absoluteUrl, SITE_NAME } from '../../../lib/site';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { ScrapButton } from '../../../components/common/ScrapButton';
import { PosterColumn } from '../../../components/show/PosterColumn';
import { InfoColumn } from '../../../components/show/InfoColumn';
import { SetlistSection } from '../../../components/show/SetlistSection';
import { ShowIntroSection } from '../../../components/show/ShowIntroSection';
import { PhotoUploadGate } from '../../../components/auth/PhotoUploadGate';
import type { SongRowData } from '../../../components/show/SongRow';
import { formatTicketOpen } from '../../../lib/ticketOpen';
import { ticketVendorFromUrl } from '@mft/shared';
import {
  inheritImage,
  inheritVenue,
  inheritTicketUrl,
  inheritTicketOpenAt,
} from '../../../lib/festivalInheritance';

export const revalidate = 86400; // 1일. 관리자 수정 시 actions.ts가 즉시 무효화.
// 동적 세그먼트의 런타임 ISR 활성화: 빌드 시엔 아무 경로도 프리렌더하지 않고,
// 첫 방문 때 렌더 후 revalidate(1시간) 동안 풀 라우트 캐시에 저장(이후 캐시 HIT).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAY_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

/** instagram.com/p/SHORTCODE → '@sourceAccount' (InstagramPost row가 있으면 사용) */
function deriveSourceLabel(account: string | null): string | null {
  if (!account) return null;
  return account.startsWith('@') ? account : `@${account}`;
}

/** 검색결과·소셜 카드에 쓰일 페이지별 제목·설명을 생성. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const show = await prisma.show.findUnique({
    where: { id },
    select: {
      status: true,
      title: true,
      imageUrl: true,
      firstSessionDate: true,
      venue: { select: { name: true, region: true } },
      artists: { select: { canonicalName: true } },
      festival: { select: { name: true, posterImageUrl: true } },
    },
  });

  if (!show || show.status !== 'APPROVED') {
    return { title: '공연을 찾을 수 없습니다' };
  }

  const artistNames = show.artists.map((a) => a.canonicalName).join(', ');
  const name = show.title || artistNames || '공연';
  const date = show.firstSessionDate
    ? new Date(show.firstSessionDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const venueName = show.venue?.name ?? show.festival?.name ?? null;

  const descParts = [artistNames, date, venueName].filter(Boolean);
  const description =
    descParts.length > 0
      ? `${descParts.join(' · ')} — ${SITE_NAME}에서 공연 정보와 셋리스트를 확인하세요.`
      : `${name} 공연 정보 — ${SITE_NAME}`;

  const image = show.imageUrl ?? show.festival?.posterImageUrl ?? '/headliner.png';
  const url = absoluteUrl(`/shows/${id}`);

  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: { title: name, description, url, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title: name, description, images: [image] },
  };
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
      // 페스티벌 내부 공연은 이미지·장소·티켓을 부모에서 상속(읽기 시점 fallback).
      festival: {
        select: {
          id: true,
          name: true,
          posterImageUrl: true,
          ticketUrl: true,
          ticketOpenAt: true,
          locationText: true,
          venue: { select: { name: true, region: true } },
        },
      },
      setlist: { include: { songs: { orderBy: { order: 'asc' } } } },
      sessions: { orderBy: { date: 'asc' } },
    },
  });

  if (!show || show.status !== 'APPROVED') notFound(); // v7: PENDING/REJECTED은 사이트에서 미노출

  // InstagramPost에서 sourceAccount 조회 (있으면 sourceLabel에 사용)
  const igPost = await prisma.instagramPost.findUnique({
    where: { canonicalUrl: show.originalPostUrl },
    select: { sourceAccount: true },
  });

  // v6: ShowSession is the canonical source. Phase 1 backfill guarantees every
  // dated Show has ≥1 session row; ingest always writes both. Legacy Show.date
  // remains as a Phase 6 cleanup target — do not read it here.
  const sessions = show.sessions.map((s) => {
    const d = new Date(s.date);
    // 세션에 티켓/예매오픈이 없으면 부모 페스티벌 통합 값으로 fallback.
    const ticketUrl = inheritTicketUrl(s.ticketUrl, show.festival);
    const ticketOpenAt = inheritTicketOpenAt(s.ticketOpenAt, show.festival);
    return {
      date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
      monthDay: [
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ] as [string, string],
      dayShort: WEEKDAY_EN[d.getDay()]!,
      dayKr: WEEKDAY_KR[d.getDay()]!,
      startTime: s.startTime,
      ticketUrl,
      ticketLabel: ticketUrl ? (ticketVendorFromUrl(ticketUrl) ?? '예매 페이지') : null,
      ticketOpenLabel: formatTicketOpen(ticketOpenAt),
      // 선예매는 session-level 전용(페스티벌 통합 상속 없음).
      presaleOpenLabel: formatTicketOpen(s.presaleOpenAt),
    };
  });

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

  // 페스티벌 내부 공연: 이미지·장소를 부모에서 상속(읽기 시점 fallback).
  const posterImage = inheritImage(show.imageUrl, show.festival);
  const venue = inheritVenue(show.venue, show.festival);

  // 구조화 데이터(schema.org MusicEvent): 구글이 검색결과에 날짜·장소를 풍부하게 노출.
  const eventName = show.title || artistsAlt || '공연';
  const startDate = show.sessions[0]?.date ?? show.firstSessionDate ?? null;
  const endDate = show.sessions[show.sessions.length - 1]?.date ?? startDate;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: eventName,
    url: absoluteUrl(`/shows/${show.id}`),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(startDate ? { startDate: new Date(startDate).toISOString().slice(0, 10) } : {}),
    ...(endDate ? { endDate: new Date(endDate).toISOString().slice(0, 10) } : {}),
    ...(posterImage ? { image: [posterImage] } : {}),
    ...(venue.name
      ? {
          location: {
            '@type': 'Place',
            name: venue.name,
            ...(venue.city ? { address: venue.city } : {}),
          },
        }
      : {}),
    ...(show.artists.length > 0
      ? {
          performer: show.artists.map((a) => ({
            '@type': 'MusicGroup',
            name: a.canonicalName,
          })),
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeHeader />

      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="flex items-center justify-between gap-3">
            <BackLink />
            <ScrapButton kind="show" id={show.id} />
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-16">
            <PosterColumn imageUrl={posterImage} alt={posterAlt} />
            <InfoColumn
              artists={show.artists}
              title={show.title}
              sessions={sessions}
              venueName={venue.name}
              city={venue.city}
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

        {/* 공연 소개(인스타 원문 발췌) — 내용이 있을 때만 렌더. */}
        <ShowIntroSection text={show.rawTextExcerpt} />

        {/* 셋리스트는 곡이 있을 때만 렌더(없으면 컴포넌트가 null 반환). */}
        <SetlistSection songs={songs} />

        {/* lazy login: 기여 행동(사진 올리기) 진입점에서만 로그인 유도(클라이언트에서 세션 확인). */}
        <PhotoUploadGate />
      </main>
    </div>
  );
}
