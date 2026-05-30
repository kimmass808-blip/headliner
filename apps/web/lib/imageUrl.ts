/**
 * Supabase Image Transformations 헬퍼.
 *
 * Storage bucket (예: `posters`)에 저장된 원본 webp는 보통 ~1440px wide. 화면 맥락에 맞춰
 * 작은 사이즈를 받고 싶을 때 이 헬퍼로 URL을 변환한다.
 *
 *   /storage/v1/object/public/posters/abc.webp
 *   → /storage/v1/render/image/public/posters/abc.webp?width=600&quality=78
 *
 * Supabase가 변환된 결과를 캐싱하므로 같은 (path, params) 조합은 첫 번째 요청만 비용.
 *
 * - Storage 공개 URL이 아닌 경우 (외부 CDN, 정적 파일 등) 입력 그대로 반환.
 * - `width` 만 지정 시 비율 유지하며 다운스케일.
 * - `quality` 미지정 시 Supabase 기본값(80) 사용.
 *
 * 참고: 동적 변환은 Pro 플랜에서 안정 동작. Free 플랜에선 호출 제한이 있을 수 있다.
 * 그 경우 path 그대로 두면 원본 webp (≤1440px)가 그대로 서빙된다.
 */
export interface ImageUrlOpts {
  width?: number;
  height?: number;
  /** 0–100. 미지정 시 Supabase 기본 80. */
  quality?: number;
  /** cover (crop to fill) | contain (fit) | fill (stretch). 기본 cover. */
  resize?: 'cover' | 'contain' | 'fill';
}

const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_PUBLIC = '/storage/v1/render/image/public/';

export function getImageUrl(url: string | null | undefined, opts: ImageUrlOpts = {}): string | null {
  if (!url) return null;
  if (!url.includes(OBJECT_PUBLIC)) return url; // 외부 또는 비-Storage URL은 그대로
  const transformed = url.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.quality !== undefined) params.set('quality', String(opts.quality));
  if (opts.resize) params.set('resize', opts.resize);
  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}
