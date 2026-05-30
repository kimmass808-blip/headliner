/**
 * 전역 네비게이션 오버레이.
 *
 * 현재 페이지를 유지한 채 중앙 스피너만 띄운다.
 * - 클릭/submit을 document 레벨에서 감지 → 즉시 isNavigating=true
 * - pathname 또는 searchParams가 바뀐 직후 → isNavigating=false
 *
 * loading.tsx 컨벤션은 page.tsx를 통째로 fallback으로 치환하므로 사용하지 않는다.
 */

'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function NavigationOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const lastKey = useRef(routeKey);
  const [isNavigating, setIsNavigating] = useState(false);

  // 라우트가 실제로 바뀐 시점에 오버레이 해제
  useEffect(() => {
    if (routeKey !== lastKey.current) {
      lastKey.current = routeKey;
      setIsNavigating(false);
    }
  }, [routeKey]);

  // 클릭/submit으로 네비게이션 시작 감지
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // 모디파이어·우클릭·중클릭 무시 (새 탭 열기 등)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.target && anchor.target !== '_self') return;
      // 외부·앵커·메일·전화 링크 무시
      if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
      // 같은 URL이면 무시
      const here = window.location.pathname + window.location.search;
      if (href === here) return;
      setIsNavigating(true);
    }
    function onSubmit() {
      setIsNavigating(true);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      role="status"
      aria-label="로딩 중"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 backdrop-blur-[2px]"
    >
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-paper" />
    </div>
  );
}
