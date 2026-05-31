/**
 * 전체 공연(`/shows`)·전체 페스티벌(`/festivals`) 리스트 페이지용 데이터.
 *
 * 홈 "다가오는 공연" 섹션과 카드 매핑 로직을 공유한다(단일 출처).
 * 페이지는 동적이지만 DB 조회 자체는 일자별로 캐시하고, 관리자 수정 시
 * `shows`/`festivals` 태그로 즉시 무효화된다(app/admin/actions.ts와 일치).
 */

import { unstable_cache } from 'next/cache';
import { prisma } from '@mft/db';
import {
  formatWeekdayShort,
  type HomePosterCardProps,
} from '../components/home/PosterCard';

export interface PosterListItem extends HomePosterCardProps {
  key: string;
}

/** unstable_cache 역직렬화 후 Date가 문자열로 올 수 있어 안전 변환. */
function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface FestivalListRow {
  id: string;
  name: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  locationText: string | null;
  posterImageUrl: string | null;
}

interface ShowListRow {
  id: string;
  firstSessionDate: Date | string | null;
  title: string | null;
  imageUrl: string | null;
  venue: { name: string | null; region: string | null } | null;
  artists: { canonicalName: string }[];
}

/** Festival → PosterCard 아이템 (홈/리스트 공통). */
export function mapFestivalToItem(f: FestivalListRow): PosterListItem {
  const start = toDate(f.startDate);
  const end = toDate(f.endDate);
  const isMultiDay = start && end && end.getTime() !== start.getTime();
  const dayLabel = isMultiDay
    ? `${Math.round((end!.getTime() - start!.getTime()) / (1000 * 60 * 60 * 24)) + 1} DAYS`
    : formatWeekdayShort(start);
  return {
    key: `f:${f.id}`,
    href: `/festivals/${f.id}`,
    type: 'FESTIVAL',
    imageUrl: f.posterImageUrl,
    primaryName: f.name,
    secondaryTitle: null,
    city: null,
    venueName: f.locationText ?? null,
    date: start,
    dayLabel,
  };
}

/** Show → PosterCard 아이템 (홈/리스트 공통). */
export function mapShowToItem(s: ShowListRow): PosterListItem {
  const d = toDate(s.firstSessionDate);
  // 공연명을 primary(상단·크게), 아티스트명을 secondary(하단·작게)로.
  const artistName = s.artists[0]?.canonicalName ?? null;
  const primaryName = s.title ?? artistName ?? '공연';
  const secondaryTitle = s.title && artistName ? artistName : null;
  return {
    key: `s:${s.id}`,
    href: `/shows/${s.id}`,
    type: 'SHOW',
    imageUrl: s.imageUrl,
    primaryName,
    secondaryTitle,
    city: s.venue?.region ?? null,
    venueName: s.venue?.name ?? null,
    date: d,
    dayLabel: formatWeekdayShort(d),
  };
}

const festivalListSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  locationText: true,
  posterImageUrl: true,
} as const;

const showListSelect = {
  id: true,
  firstSessionDate: true,
  title: true,
  imageUrl: true,
  venue: { select: { name: true, region: true } },
  artists: { select: { canonicalName: true } },
} as const;

/** 전체 다가오는 페스티벌 (승인·완성도≥1·시작일 미래). 홈과 달리 take 제한 없음. */
export const getAllUpcomingFestivals = unstable_cache(
  async (startOfTodayMs: number) => {
    const startOfToday = new Date(startOfTodayMs);
    return prisma.festival.findMany({
      where: {
        status: 'APPROVED',
        startDate: { gte: startOfToday },
        completeness: { gte: 1 },
      },
      orderBy: [{ startDate: 'asc' }],
      select: festivalListSelect,
    });
  },
  ['listing-festivals-v1'],
  { revalidate: 86400, tags: ['festivals'] },
);

/** 전체 다가오는 단독공연 (승인·완성도≥1·진행중 포함·중복/페스티벌 child 제외). */
export const getAllUpcomingShows = unstable_cache(
  async (startOfTodayMs: number) => {
    const startOfToday = new Date(startOfTodayMs);
    return prisma.show.findMany({
      where: {
        status: 'APPROVED',
        lastSessionDate: { gte: startOfToday },
        completeness: { gte: 1 },
        duplicateOfShowId: null,
        festivalId: null,
      },
      orderBy: [{ firstSessionDate: 'asc' }],
      select: showListSelect,
    });
  },
  ['listing-shows-v1'],
  { revalidate: 86400, tags: ['shows'] },
);
