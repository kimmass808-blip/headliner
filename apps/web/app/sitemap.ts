import type { MetadataRoute } from 'next';
import { prisma } from '@mft/db';
import { SITE_URL } from '../lib/site';

/**
 * /sitemap.xml — 검색 엔진에 제공하는 전체 페이지 지도.
 *
 * 정적 페이지 + APPROVED 상태의 공연·페스티벌·아티스트 상세 페이지를 모두 포함.
 * 모든 쿼리는 읽기 전용(findMany select)이라 DB를 변경하지 않는다.
 *
 * 24시간마다 재생성(상세 페이지 revalidate와 동일 주기)되어 새 공연이 반영된다.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shows`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/festivals`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/calendar`, changeFrequency: 'daily', priority: 0.8 },
  ];

  // 사이트에 공개되는(APPROVED, 중복 아님) 항목만 색인 대상.
  const [shows, festivals, artists] = await Promise.all([
    prisma.show.findMany({
      where: { status: 'APPROVED', duplicateOfShowId: null },
      select: { id: true, updatedAt: true },
    }),
    prisma.festival.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, updatedAt: true },
    }),
    // 아티스트는 공개된 공연이 1개 이상 있는 경우만(빈 페이지 색인 방지).
    prisma.artist.findMany({
      where: { shows: { some: { status: 'APPROVED', duplicateOfShowId: null } } },
      select: { id: true },
    }),
  ]);

  const showRoutes: MetadataRoute.Sitemap = shows.map((s) => ({
    url: `${SITE_URL}/shows/${s.id}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const festivalRoutes: MetadataRoute.Sitemap = festivals.map((f) => ({
    url: `${SITE_URL}/festivals/${f.id}`,
    lastModified: f.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const artistRoutes: MetadataRoute.Sitemap = artists.map((a) => ({
    url: `${SITE_URL}/artists/${a.id}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...showRoutes, ...festivalRoutes, ...artistRoutes];
}
