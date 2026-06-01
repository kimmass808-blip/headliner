'use client';

import { useEffect } from 'react';

// 클라이언트에서 서비스워커를 등록한다. 프로덕션에서만 동작 — 개발 중엔
// SW 캐시가 HMR/리로드를 방해하므로 등록하지 않고, 혹시 등록돼 있으면 해제한다.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 등록 실패는 조용히 무시 — PWA 미설치 상태로 정상 동작.
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
