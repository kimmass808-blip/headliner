'use client';

import { useCallback, useEffect, useState } from 'react';
import { getImageUrl } from '../../lib/imageUrl';

interface InfoLightboxProps {
  images: string[];
  title: string;
  bodyText?: string | null;
  onClose: () => void;
}

// IG 캐러셀 원본 이미지를 좌/우 내비게이션으로 보여주는 라이트박스 오버레이.
export function InfoLightbox({ images, title, bodyText, onClose }: InfoLightboxProps) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const total = images.length;

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  // 이미지를 넘길 때마다 로드 상태를 초기화해 이전 이미지 잔상을 비운다.
  useEffect(() => {
    setLoaded(false);
  }, [idx]);

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

        {!loaded ? (
          <div
            className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper/30 border-t-paper/80" />
          </div>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={idx}
          src={src ?? ''}
          alt={`${title} (${idx + 1}/${total})`}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`mx-auto max-h-[85vh] w-auto object-contain transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
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
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[12px] tabular-nums text-paper/80">
            {idx + 1} / {total}
          </div>
        ) : null}
      </div>

      {bodyText ? (
        <div
          className="absolute inset-x-0 bottom-0 max-h-[35vh] overflow-y-auto border-t border-white/10 bg-black/80 px-6 py-5 backdrop-blur-sm sm:px-12"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mx-auto max-w-[760px] whitespace-pre-line text-[13.5px] leading-relaxed text-paper/85">
            {bodyText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
