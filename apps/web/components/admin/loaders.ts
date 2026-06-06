import { prisma } from '@mft/db';
import type { FestivalInfoVM, FestivalOption, FestivalVM, ItemVM, ShowVM } from './types';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** UTC Date → 'YYYY.MM.DD' (matches the design's dotted format). */
function ymd(d: Date | null | undefined): string {
  if (!d) return '';
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${mo}.${da}`;
}
function dayAbbrev(d: Date | null | undefined): string {
  return d ? DAYS[d.getUTCDay()] : '';
}

const showSelect = {
  id: true,
  title: true,
  status: true,
  originalPostUrl: true,
  imageUrl: true,
  completeness: true,
  duplicateOfShowId: true,
  reviewerNote: true,
  venue: { select: { name: true, region: true } },
  artists: { select: { canonicalName: true } },
  festival: { select: { id: true, name: true } },
  sessions: { orderBy: { date: 'asc' as const }, select: { date: true } },
} as const;

const festSelect = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  locationText: true,
  posterImageUrl: true,
  completeness: true,
  reviewerNote: true,
  _count: { select: { shows: true } },
} as const;

type ShowRow = Awaited<ReturnType<typeof prisma.show.findFirst<{ select: typeof showSelect }>>>;
type FestRow = Awaited<ReturnType<typeof prisma.festival.findFirst<{ select: typeof festSelect }>>>;

function toShowVM(s: NonNullable<ShowRow>): ShowVM {
  return {
    id: s.id,
    type: 'SHOW',
    status: s.status as ShowVM['status'],
    title: s.title ?? '',
    artists: s.artists.map((a) => a.canonicalName),
    venue: s.venue?.name ?? '',
    city: s.venue?.region ?? '',
    sessions: s.sessions.map((x) => ({ date: ymd(x.date), day: dayAbbrev(x.date) })),
    festival: s.festival?.name ?? null,
    festivalId: s.festival?.id ?? null,
    poster: s.imageUrl ?? null,
    igHandle: null,
    igUrl: s.originalPostUrl,
    dupOf: s.duplicateOfShowId ?? null,
    completeness: s.completeness,
    rejectReason: s.reviewerNote ?? null,
  };
}

function toFestVM(f: NonNullable<FestRow>): FestivalVM {
  const missing: string[] = [];
  if (!f.name) missing.push('name');
  if (!f.startDate) missing.push('startDate');
  if (f._count.shows === 0) missing.push('shows');
  return {
    id: f.id,
    type: 'FESTIVAL',
    status: f.status as FestivalVM['status'],
    name: f.name ?? '',
    startDate: ymd(f.startDate),
    endDate: ymd(f.endDate),
    location: f.locationText ?? '',
    city: '',
    linkedShows: f._count.shows,
    poster: f.posterImageUrl ?? null,
    igHandle: null,
    igUrl: '',
    missing,
    dupOf: null,
    completeness: f.completeness,
    rejectReason: f.reviewerNote ?? null,
  };
}

export async function loadPendingShows(): Promise<ShowVM[]> {
  const rows = await prisma.show.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: showSelect,
  });
  return rows.map(toShowVM);
}

export async function loadPendingFestivals(): Promise<FestivalVM[]> {
  const rows = await prisma.festival.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: festSelect,
  });
  return rows.map(toFestVM);
}

const infoSelect = {
  id: true,
  status: true,
  category: true,
  title: true,
  imageUrls: true,
  sourcePostUrl: true,
  postedAt: true,
  festival: { select: { name: true } },
} as const;

type InfoRow = Awaited<ReturnType<typeof prisma.festivalInfo.findFirst<{ select: typeof infoSelect }>>>;

function toFestivalInfoVM(fi: NonNullable<InfoRow>): FestivalInfoVM {
  return {
    id: fi.id,
    type: 'FESTIVAL_INFO',
    status: fi.status as FestivalInfoVM['status'],
    festivalName: fi.festival?.name ?? '',
    category: fi.category as FestivalInfoVM['category'],
    title: fi.title ?? '',
    imageUrls: fi.imageUrls,
    sourcePostUrl: fi.sourcePostUrl,
    postedAt: ymd(fi.postedAt),
  };
}

export async function loadPendingFestivalInfos(): Promise<FestivalInfoVM[]> {
  const rows = await prisma.festivalInfo.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: infoSelect,
  });
  return rows.map(toFestivalInfoVM);
}

/** APPROVED + REJECTED shows and festivals, merged for the data-management table. */
export async function loadManaged(): Promise<ItemVM[]> {
  const [shows, fests] = await Promise.all([
    prisma.show.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      // reviewedAt 가 비어있는(null) 항목이 대다수라, 검수일시 우선 + 생성일시 보조로 안정 정렬.
      orderBy: [{ reviewedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 5000,
      select: showSelect,
    }),
    prisma.festival.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: [{ reviewedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 5000,
      select: festSelect,
    }),
  ]);
  return [...shows.map(toShowVM), ...fests.map(toFestVM)];
}

export async function loadFestivalOptions(): Promise<FestivalOption[]> {
  const rows = await prisma.festival.findMany({
    orderBy: { startDate: 'desc' },
    take: 500,
    select: { id: true, name: true },
  });
  return rows.map((f) => ({ id: f.id, name: f.name ?? '(이름 없음)' }));
}

export async function loadArtistSuggest(): Promise<string[]> {
  const rows = await prisma.artist.findMany({
    orderBy: { canonicalName: 'asc' },
    take: 1000,
    select: { canonicalName: true },
  });
  return rows.map((a) => a.canonicalName);
}
