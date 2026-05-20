/**
 * @mft/crawler — IG 자동 크롤링 + 정규화 적재 + 시드 확장.
 *
 * 흐름:
 *   1. ig-fetch: SeedAccount.status IN ('active', 'pending') 순회, IG 게시물 fetch
 *   2. normalizer: classify + extract (Show 또는 Festival)
 *   3. canonicalize: venue·artist·igUrl·igHandle 정규화
 *   4. dedup: fingerprint upsert (completeness=3에서만), originalPostUrl 자연 키
 *   5. seed-expand: 페스티벌 라인업 게시물의 @handle → SeedAccount(status='pending')
 *   6. CrawlRun 통계 적재 + Discord 알림
 */

export { computeShowFingerprint } from './fingerprint.js';
export type { FingerprintInputs } from './fingerprint.js';

export { fetchAccountPosts } from './ig-fetch.js';
export type { FetchedPost, FetchAccountResult } from './ig-fetch.js';

export { upsertShow } from './dedup.js';
export type { UpsertShowInput, UpsertShowResult } from './dedup.js';

export { expandSeed } from './seed-expand.js';
export type { ExpandSeedInput, ExpandSeedResult } from './seed-expand.js';

export { maybePromoteSeed, recordFetchOutcome } from './seed-lifecycle.js';

export { runCrawl } from './run.js';
