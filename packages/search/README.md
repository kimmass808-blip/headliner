# @mft/search

검색 엔진 어댑터 — `SearchEngine` interface 단일 진입점.

## 채택 엔진은 Phase 0 spike 결과에 따라 결정

[`docs/phase0-search-spike.md`](../../docs/phase0-search-spike.md) 참조.

후보:
1. **pgroonga** (preferred) — Korean morphology 지원, Supabase에 설치 가능하면 1순위
2. **pg_trgm + alias** (fallback) — Supabase 기본 포함, trigram fuzzy match
3. **Meilisearch** — AC-23 트리거 시 V1.5 마이그레이션 후보

## 인터페이스

```ts
import type { SearchEngine } from '@mft/search';

const engine: SearchEngine = postgresFtsEngine; // 또는 meilisearchEngine
const response = await engine.search('잔나비');
// response.contextMode = 'artist_mode'
// response.results = [...]
```

## AC-7 / AC-8 매핑

- AC-7 (랭킹): `final_score = ts_rank × completeness_weight`, 2단 정렬 (tier DESC, final_score DESC)
- AC-8 (컨텍스트 적응): festival.top.score > artist.top.score × 1.5 AND token 매칭 → festival_mode (Festival 카드 상단, 그 Festival의 Shows 필터아웃)
