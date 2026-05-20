/**
 * @mft/search — Swappable search backend.
 *
 * Phase 0 spike (docs/phase0-search-spike.md) 결과에 따라 어댑터 1개 선택:
 *   - pgroonga (preferred, Korean morphology)
 *   - pg_trgm + alias (fallback)
 *   - Meilisearch (AC-23 트리거 시)
 *
 * 검색 라우트(`apps/web/app/api/search/route.ts`)는 항상 `SearchEngine` interface로 호출.
 * 어댑터 교체는 export 한 줄만 바꿔서 가능.
 */

export type {
  SearchEngine,
  SearchKind,
  SearchResult,
  SearchOptions,
  ContextMode,
} from './types.js';

// Phase 1 단계 — Postgres FTS 어댑터 구현됨 (pgroonga + pg_trgm 둘 다 ENV 분기)
export { PostgresFtsEngine, postgresFtsEngine } from './adapters/postgres-fts.js';

// Phase 2.7 평가 결과 따라 활성화될 Meilisearch 어댑터 (AC-23 트리거)
// export { meilisearchEngine } from './adapters/meilisearch.js';

/**
 * 기본 export — 가장 표준 어댑터.
 * 검색 라우트 (apps/web/app/api/search/route.ts) 에서:
 *   import { defaultSearchEngine } from '@mft/search';
 *   const result = await defaultSearchEngine.search(q);
 */
export { postgresFtsEngine as defaultSearchEngine } from './adapters/postgres-fts.js';
