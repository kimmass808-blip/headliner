import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

/**
 * /robots.txt — 검색 로봇 크롤 규칙.
 * - 공개 페이지는 모두 허용.
 * - /admin, /api, /scrapped(개인 스크랩)는 색인 제외.
 * - sitemap 위치를 명시해 구글이 전체 페이지 목록을 찾도록 안내.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/scrapped'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
