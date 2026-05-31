/**
 * Headliner — Artist 상세 페이지 (다크 무드 / design_handoff_headliner_artist 기준).
 */

import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { ShowsGrid, type ShowsGridItem } from '../../../components/common/ShowsGrid';
import { NoShowsState } from '../../../components/common/NoShowsState';
import type { ExternalLink } from '../../../components/common/ExternalLinks';
import type { PlatformKind } from '../../../components/common/PlatformIcon';
import { HeroSection } from '../../../components/artist/HeroSection';
import { BioSection } from '../../../components/artist/BioSection';
import { formatWeekdayShort } from '../../../components/home/PosterCard';

export const revalidate = 86400; // 1일. 관리자 수정 시 actions.ts가 즉시 무효화.
// 동적 세그먼트의 런타임 ISR 활성화: 빌드 시엔 아무 경로도 프리렌더하지 않고,
// 첫 방문 때 렌더 후 revalidate(1시간) 동안 풀 라우트 캐시에 저장(이후 캐시 HIT).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const KNOWN_PLATFORMS: PlatformKind[] = [
  'instagram', 'website', 'youtube', 'spotify', 'bandcamp', 'twitter',
];

/** href에 안전한 스킴인지 검사 — javascript:/data:/file: 등 차단해 stored XSS 방지. */
function isSafeHref(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** externalLinks JSON에서 plataform → url 매핑을 추출 */
function parseExternalLinks(raw: unknown): { kind: PlatformKind; url: string }[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: { kind: PlatformKind; url: string }[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const kind = key.toLowerCase() as PlatformKind;
    if (!KNOWN_PLATFORMS.includes(kind)) continue;
    if (typeof value !== 'string' || value.length === 0) continue;
    if (!isSafeHref(value)) continue; // javascript:/data:/file: 등 차단
    out.push({ kind, url: value });
  }
  return out;
}

/** URL의 host에서 사람이 읽을 만한 라벨 추출 */
function urlToLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      shows: {
        where: { status: 'APPROVED', duplicateOfShowId: null }, // v7: PENDING/REJECTED은 사이트에서 미노출
        // v6: sort by firstSessionDate (denormalized from sessions[0].date)
        orderBy: [{ firstSessionDate: 'asc' }],
        include: {
          venue: { select: { id: true, name: true, region: true } },
          festival: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!artist) notFound();

  // 외부 링크 모음 — igHandle + externalLinks JSON
  const links: ExternalLink[] = [];
  if (artist.igHandle) {
    links.push({
      kind: 'instagram',
      label: `@${artist.igHandle}`,
      url: `https://instagram.com/${artist.igHandle}`,
    });
  }
  for (const ext of parseExternalLinks(artist.externalLinks)) {
    // igHandle로 이미 instagram을 추가했다면 중복 방지
    if (ext.kind === 'instagram' && artist.igHandle) continue;
    links.push({ kind: ext.kind, label: urlToLabel(ext.url), url: ext.url });
  }

  // bio 문단 분리 (빈 줄 기준)
  const bioParagraphs = artist.bioText
    ? artist.bioText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];

  // shows를 upcoming/past로 분리
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // arrow const는 narrowing 이후 정의되므로 `artist`가 non-null로 추론됨.
  // (function 선언은 hoisting 때문에 TS가 `artist` 가능성 null로 봄)
  const mapShow = (show: (typeof artist.shows)[number]): ShowsGridItem => {
    // v6: card displays first session date. Multi-session range is shown on
    // the show detail page; cards remain single-date for layout simplicity.
    const d = show.firstSessionDate ? new Date(show.firstSessionDate) : null;
    return {
      key: show.id,
      href: `/shows/${show.id}`,
      type: 'SHOW',
      imageUrl: show.imageUrl,
      primaryName: show.festival
        ? show.festival.name
        : (show.title ?? '공연'),
      secondaryTitle: show.festival ? show.title : null,
      city: show.venue?.region ?? null,
      venueName: show.venue?.name ?? null,
      date: d,
      dayLabel: formatWeekdayShort(d),
    };
  };

  // v6: upcoming = any session today or later (use lastSessionDate so multi-day
  // shows mid-run still count as upcoming). Past = lastSessionDate before today.
  const upcomingShows: ShowsGridItem[] = artist.shows
    .filter((s) => s.lastSessionDate && new Date(s.lastSessionDate) >= startOfToday)
    .map(mapShow);
  const pastShows: ShowsGridItem[] = artist.shows
    .filter((s) => !s.lastSessionDate || new Date(s.lastSessionDate) < startOfToday)
    .map(mapShow)
    .reverse(); // 최신 지난 공연부터

  const photo = artist.imageUrl ?? artist.spotifyImageUrl ?? null;
  const hasNoShows = upcomingShows.length === 0 && pastShows.length === 0;

  return (
    <div className="min-h-screen bg-ink-900 pb-24 font-sans text-paper">
      <HomeHeader />

      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <BackLink />
        </section>

        <HeroSection
          name={artist.canonicalName}
          aliases={artist.aliases}
          photo={photo}
          links={links}
        />

        <BioSection paragraphs={bioParagraphs} />

        {hasNoShows ? (
          <NoShowsState />
        ) : (
          <>
            <ShowsGrid
              items={upcomingShows}
              kicker={`UPCOMING / ${new Date().getFullYear()}`}
              title="다가오는 공연"
            />
            <ShowsGrid
              items={pastShows}
              kicker="ARCHIVE"
              title="지난 공연"
            />
          </>
        )}
      </main>
    </div>
  );
}
