/**
 * Headliner — Artist 셋리스트 모음 페이지 — `/artists/[id]/setlists`.
 *
 * 아티스트 상세와 동일한 구조(헤더 / 뒤로가기 / Hero / Bio)를 유지하되,
 * 다가오는·지난 공연 그리드 대신 "셋리스트 등록 공연" 그리드 하나만 노출한다.
 * 셋리스트(곡 1곡 이상)가 등록된 승인 공연만, 최신 공연부터.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { absoluteUrl, SITE_NAME } from '../../../../lib/site';
import { HomeHeader } from '../../../../components/home/Header';
import { BackLink } from '../../../../components/common/BackLink';
import { ShowsGrid, type ShowsGridItem } from '../../../../components/common/ShowsGrid';
import { inheritImage, inheritVenue } from '../../../../lib/festivalInheritance';
import type { ExternalLink } from '../../../../components/common/ExternalLinks';
import type { PlatformKind } from '../../../../components/common/PlatformIcon';
import { HeroSection } from '../../../../components/artist/HeroSection';
import { BioSection } from '../../../../components/artist/BioSection';
import { formatWeekdayShort } from '../../../../components/home/PosterCard';

export const revalidate = 86400; // 1일. 관리자 수정 시 actions.ts가 즉시 무효화.
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

/** externalLinks JSON에서 platform → url 매핑을 추출 */
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

/** 셋리스트(곡 1곡 이상)가 등록된 승인 공연 수 */
async function countSetlistShows(artistId: string): Promise<number> {
  return prisma.show.count({
    where: {
      status: 'APPROVED',
      duplicateOfShowId: null,
      artists: { some: { id: artistId } },
      setlist: { is: { songs: { some: {} } } },
    },
  });
}

/** 검색결과·소셜 카드에 쓰일 셋리스트 페이지 제목·설명을 생성. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = await prisma.artist.findUnique({
    where: { id },
    select: { canonicalName: true, imageUrl: true, genres: true },
  });

  if (!artist) {
    return { title: '아티스트를 찾을 수 없습니다', robots: { index: false, follow: false } };
  }

  const setlistCount = await countSetlistShows(id);
  const url = absoluteUrl(`/artists/${id}/setlists`);
  const image = artist.imageUrl ?? '/headliner.png';
  const title = `${artist.canonicalName} 셋리스트 모음`;
  const description =
    setlistCount > 0
      ? `${artist.canonicalName}의 역대 공연 셋리스트 ${setlistCount}건 — 공연별 곡 목록과 정보를 ${SITE_NAME}에서 확인하세요.`
      : `${artist.canonicalName}의 공연 셋리스트를 ${SITE_NAME}에서 확인하세요.`;

  return {
    title,
    description,
    // 셋리스트가 없으면 빈 페이지가 색인되지 않도록 noindex.
    robots: setlistCount === 0 ? { index: false, follow: true } : undefined,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image }] },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ArtistSetlistsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      shows: {
        where: {
          status: 'APPROVED',
          duplicateOfShowId: null,
          // 곡이 1곡 이상 등록된 셋리스트가 있는 공연만.
          setlist: { is: { songs: { some: {} } } },
        },
        // 최신 공연부터 (셋리스트는 보통 지난 공연 기록).
        orderBy: [{ firstSessionDate: 'desc' }],
        include: {
          venue: { select: { id: true, name: true, region: true } },
          festival: {
            select: {
              id: true,
              name: true,
              posterImageUrl: true,
              ticketUrl: true,
              locationText: true,
              venue: { select: { name: true, region: true } },
            },
          },
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
    if (ext.kind === 'instagram' && artist.igHandle) continue;
    links.push({ kind: ext.kind, label: urlToLabel(ext.url), url: ext.url });
  }

  // bio 문단 분리 (빈 줄 기준)
  const bioParagraphs = artist.bioText
    ? artist.bioText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];

  const mapShow = (show: (typeof artist.shows)[number]): ShowsGridItem => {
    const d = show.firstSessionDate ? new Date(show.firstSessionDate) : null;
    const venue = inheritVenue(show.venue, show.festival);
    return {
      key: show.id,
      href: `/shows/${show.id}`,
      type: 'SHOW',
      imageUrl: inheritImage(show.imageUrl, show.festival),
      primaryName: show.festival ? show.festival.name : (show.title ?? '공연'),
      secondaryTitle: show.festival ? show.title : null,
      city: venue.city,
      venueName: venue.name,
      date: d,
      dayLabel: formatWeekdayShort(d),
    };
  };

  const setlistShows: ShowsGridItem[] = artist.shows.map(mapShow);

  const photo = artist.imageUrl ?? artist.spotifyImageUrl ?? null;

  return (
    <div className="min-h-screen bg-ink-900 pb-24 font-sans text-paper">
      <HomeHeader />

      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <BackLink fallbackHref={`/artists/${id}`} />
        </section>

        <HeroSection
          name={artist.canonicalName}
          aliases={artist.aliases}
          photo={photo}
          links={links}
        />

        <BioSection paragraphs={bioParagraphs} />

        <ShowsGrid
          items={setlistShows}
          kicker="SETLISTS"
          title="셋리스트 등록 공연"
          initialLimit={0}
          emptyLabel="등록된 셋리스트가 없습니다."
        />
      </main>
    </div>
  );
}
