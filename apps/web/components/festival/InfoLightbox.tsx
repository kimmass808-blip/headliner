'use client';

import { useCallback, useEffect, useState } from 'react';
import { getImageUrl } from '../../lib/imageUrl';

interface InfoLightboxProps {
  images: string[];
  title: string;
  onClose: () => void;
}

// IG 캐러셀 원본 이미지를 좌/우 내비게이션으로 보여주는 라이트박스 오버레이.
export function InfoLightbox({ images, title, onClose }: InfoLightboxProps) {
  const [idx, setIdx] = useState(0);
  const total = images.length;

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!total) return null;

  const src = getImageUrl(images[idx], { width: 1600, quality: 90, resize: 'contain' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-[13px] text-paper hover:bg-white/20"
      >
        ✕
      </button>

      <div
        className="relative flex h-full w-full max-w-[1100px] items-center justify-center px-12"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 ? (
          <button
            onClick={prev}
            aria-label="이전 이미지"
            className="absolute left-2 z-10 rounded-full bg-white/10 px-3 py-3 text-[18px] leading-none text-paper hover:bg-white/20"
          >
            ‹
          </button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src ?? ''}
          alt={`${title} (${idx + 1}/${total})`}
          decoding="async"
          className="mx-auto max-h-[85vh] w-auto object-contain"
        />

        {total > 1 ? (
          <button
            onClick={next}
            aria-label="다음 이미지"
            className="absolute right-2 z-10 rounded-full bg-white/10 px-3 py-3 text-[18px] leading-none text-paper hover:bg-white/20"
          >
            ›
          </button>
        ) : null}

        {total > 1 ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[12px] tabular-nums text-paper/80">
            {idx + 1} / {total}
          </div>
        ) : null}
      </div>
    </div>
  );
}
