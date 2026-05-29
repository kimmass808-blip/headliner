/**
 * 스크랩(북마크) 저장소 — localStorage 기반.
 *
 * - 가입 없는 익명 사이트라 서버 사용자 모델 대신 브라우저 단위 저장
 * - 스키마 versioning: 키 이름에 `:v1` 붙여 향후 마이그레이션 안전
 * - Safari private mode / quota 초과는 try/catch silent fallback
 * - 같은 브라우저의 멀티 탭 동기화는 native `storage` 이벤트 사용
 */

const STORAGE_KEY = 'headliner:scraps:v1';

export interface Scrap {
  kind: 'show' | 'festival';
  id: string;
  /** ISO timestamp — 정렬 키로 사용 */
  addedAt: string;
}

function readRaw(): Scrap[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 형식 검증 — 잘못된 row는 무시
    return parsed.filter(
      (s): s is Scrap =>
        typeof s === 'object' &&
        s !== null &&
        (((s as Scrap).kind === 'show') || ((s as Scrap).kind === 'festival')) &&
        typeof (s as Scrap).id === 'string' &&
        typeof (s as Scrap).addedAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeRaw(scraps: Scrap[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scraps));
  } catch {
    // quota 초과 / private mode silent fallback
  }
  notifyLocal();
}

// 같은 탭(same window) 내 구독자 콜백
const localSubscribers = new Set<() => void>();
function notifyLocal(): void {
  for (const cb of localSubscribers) cb();
}

export function getScraps(): Scrap[] {
  return readRaw();
}

export function isScrapped(kind: Scrap['kind'], id: string): boolean {
  return readRaw().some((s) => s.kind === kind && s.id === id);
}

export function addScrap(kind: Scrap['kind'], id: string): void {
  const list = readRaw();
  if (list.some((s) => s.kind === kind && s.id === id)) return; // idempotent
  list.push({ kind, id, addedAt: new Date().toISOString() });
  writeRaw(list);
}

export function removeScrap(kind: Scrap['kind'], id: string): void {
  const list = readRaw().filter((s) => !(s.kind === kind && s.id === id));
  writeRaw(list);
}

export function getScrapCount(): number {
  return readRaw().length;
}

/**
 * 스크랩 변경 구독 — 같은 탭(local) + 다른 탭(storage event) 모두 커버.
 * 반환된 unsubscribe 함수를 useEffect cleanup에서 호출.
 */
export function subscribe(cb: () => void): () => void {
  localSubscribers.add(cb);
  let removeStorage: (() => void) | null = null;
  if (typeof window !== 'undefined') {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) cb();
    };
    window.addEventListener('storage', handler);
    removeStorage = () => window.removeEventListener('storage', handler);
  }
  return () => {
    localSubscribers.delete(cb);
    removeStorage?.();
  };
}
