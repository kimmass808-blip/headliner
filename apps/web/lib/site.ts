/**
 * 사이트의 공개(canonical) 주소. SEO용 절대 URL 생성에 쓰인다.
 *
 * 우선순위:
 *   1) NEXT_PUBLIC_SITE_URL (Vercel 프로덕션 env로 주입 — 예: https://www.headliner.co.kr)
 *   2) 프로덕션 기본 도메인 fallback
 *
 * 주의: 실제 서비스 도메인은 www가 붙은 https://www.headliner.co.kr 이다
 * (apex인 headliner.co.kr 은 www로 리다이렉트됨). canonical·sitemap·OG가
 * 리다이렉트 없는 최종 주소를 가리키도록 www를 기본값으로 둔다.
 */
const RAW = process.env.NEXT_PUBLIC_SITE_URL?.trim();

// localhost가 아니면 env 값을, 아니면 프로덕션 도메인을 기본값으로.
const RESOLVED =
  RAW && !RAW.includes('localhost') ? RAW.replace(/\/$/, '') : 'https://www.headliner.co.kr';

// apex(headliner.co.kr)는 www로 301 리다이렉트되므로, env에 www 없는 주소가
// 들어와도 강제로 www를 붙인다. 이렇게 해야 sitemap·robots·canonical이 모두
// 리다이렉트 없는 최종 주소를 가리켜 검색엔진이 sitemap을 바로 읽는다(404 방지).
export const SITE_URL = RESOLVED.replace(
  /^https?:\/\/headliner\.co\.kr/,
  'https://www.headliner.co.kr',
);

export const SITE_NAME = 'HEADLINER';
export const SITE_DESCRIPTION = '전국 인디 씬 공연·페스티벌을 한 곳에서.';

/** 상대 경로를 절대 URL로 변환 (예: '/shows/abc' → 'https://www.headliner.co.kr/shows/abc') */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
