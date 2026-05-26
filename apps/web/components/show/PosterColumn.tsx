/**
 * Show 상세 좌측 컬럼 — 포스터 + 작은 캡션.
 * 원본 비율 유지(object-contain), max-h 70vh.
 */

export interface PosterColumnProps {
  imageUrl: string | null;
  alt: string;
  dateLabel: string | null;
}

export function PosterColumn({ imageUrl, alt, dateLabel }: PosterColumnProps) {
  return (
    <div className="w-full">
      <div className="relative flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-md bg-ink-800 sm:h-[70vh]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={alt}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-[11px] uppercase tracking-widest text-paper/30">
            No poster
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-dim">
        <span>POSTER · 원본 비율 유지</span>
        {dateLabel ? <span>{dateLabel}</span> : null}
      </div>
    </div>
  );
}
