/**
 * Show 상세 좌측 컬럼 — 포스터.
 * 원본 비율 유지(object-contain), max-h 70vh.
 */

import { getImageUrl, getImageSrcSet } from '../../lib/imageUrl';

export interface PosterColumnProps {
  imageUrl: string | null;
  alt: string;
}

export function PosterColumn({ imageUrl, alt }: PosterColumnProps) {
  // 상세 페이지 — 큰 사이즈로 선명하게. retina 고려해 1200px 요청.
  const src = getImageUrl(imageUrl, { width: 1200, quality: 82, resize: 'contain' });
  // 반응형: 모바일 풀폭 ~ 데스크탑 좌측 컬럼(최대 520px). 작은 화면은 더 작은 원본.
  const srcSet = getImageSrcSet(imageUrl, [600, 900, 1200], { quality: 82 });
  return (
    <div className="w-full">
      <div className="relative flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-md bg-ink-800 sm:h-[70vh]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            srcSet={srcSet}
            sizes="(max-width: 1024px) 92vw, 520px"
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-[11px] uppercase tracking-widest text-paper/30">
            No poster
          </div>
        )}
      </div>
    </div>
  );
}
