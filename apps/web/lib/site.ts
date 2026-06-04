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

// localhost가 아니면 그대로, localhost거나 미설정이면 프로덕션 도메인을 기본값으로.
export const SITE_URL =
  RAW && !RAW.includes('localhost') ? RAW.replace(/\/$/, '') : 'https://www.headliner.co.kr';

export const SITE_NAME = 'HEADLINER';
export const SITE_DESCRIPTION = '전국 인디 씬 공연·페스티벌을 한 곳에서.';

/** 상대 경로를 절대 URL로 변환 (예: '/shows/abc' → 'https://headliner.co.kr/shows/abc') */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
