/* HEADLINER 서비스워커.
 * 캐싱 전략은 "최신성 우선"으로 보수적으로 잡는다 — 업데이트 후 옛 화면이 뜨는 사고 방지.
 *  - 페이지(navigate): 네트워크 우선, 오프라인일 때만 캐시. HTML은 절대 묵은 걸 안 줌.
 *  - Next 정적 자산(/_next/static, 해시 파일): 캐시 우선 (불변이라 안전).
 *  - 이미지: stale-while-revalidate.
 *  - API / 비-GET: 캐싱하지 않고 항상 네트워크.
 * CACHE_VERSION을 올리면 기존 캐시가 정리된다.
 */
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `img-${CACHE_VERSION}`;
const PAGE_CACHE = `page-${CACHE_VERSION}`;
const KEEP = new Set([STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE]);

self.addEventListener('install', () => {
  // 새 워커를 즉시 활성화 (대기 단계 건너뜀).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 버전이 다른 옛 캐시 제거.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isImage(request, url) {
  return (
    request.destination === 'image' ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:png|jpg|jpeg|webp|avif|gif|svg)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // GET이 아니거나 외부 출처면 그대로 통과.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // API 라우트는 항상 네트워크.
  if (url.pathname.startsWith('/api/')) return;

  // 페이지 내비게이션: 네트워크 우선.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(PAGE_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // 해시된 정적 자산: 캐시 우선.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // 이미지: stale-while-revalidate.
  if (isImage(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })(),
    );
  }
});
