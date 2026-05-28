/**
 * 상세 페이지 상단의 "← 검색으로" 링크.
 *
 * 동작: 브라우저 히스토리가 있으면 router.back()으로 이전 페이지로,
 * 없으면(직접 URL 진입) `fallbackHref`(기본 '/')로 fallback.
 */

'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from './Icons';

export function BackLink({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();

  function handleClick() {
    // window.history.length는 직접 진입(1) vs 내부 네비게이션(2+) 구분에 사용.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-paper/55 transition hover:text-paper"
    >
      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
      검색으로
    </button>
  );
}
