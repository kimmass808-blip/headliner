# Runbook: PostgreSQL FTS → Meilisearch 마이그레이션

## 트리거 조건 (AC-23)

다음 중 **하나 이상** 발생하면 이 runbook을 시작한다.

1. **MV refresh 시간 초과**: `REFRESH MATERIALIZED VIEW search_index` 실행 시간 > 2분
2. **검색 응답 시간 초과**: `GET /api/search?q=...` p95 > 800ms (AC-12 게이트)
3. **정확도 부족**: AC-20 ground-truth 평가에서 20개 쿼리 AC-8 분기 정확도 < 80% (한국어 형태소 분석 한계)

---

## 호스팅 옵션 비교

| 옵션 | 비용 | 관리 | 특징 |
|---|---|---|---|
| **Meilisearch Cloud (managed)** | ~$29/월 | Meilisearch 관리 | 즉시 사용 가능, 백업·확장 자동 |
| **Fly.io self-host** | ~$15/월 | 직접 관리 | 가격 저렴, Docker 배포 간단 |
| **Railway self-host** | ~$7/월 (starter) | 직접 관리 | 가장 저렴, Postgres 연동 간편 |

**권장:** 초기에는 **Meilisearch Cloud** (관리 부담 0)로 시작. 비용 최적화 필요하면 Fly.io로 마이그레이션.

---

## 단계 1: Meilisearch 인스턴스 프로비저닝

### 옵션 A: Meilisearch Cloud

1. [Meilisearch Cloud](https://cloud.meilisearch.com) 접속
2. 새 프로젝트 생성
3. **Region**: Asia (Tokyo) 선택 (한국 인접)
4. API key 2개 생성:
   - **Master Key** (admin용, 시크릿 보관)
   - **Search Key** (공개 검색용, 클라이언트에 노출 가능)

**환경 변수 저장:**
```
MEILISEARCH_HOST=https://...meilisearch.com
MEILISEARCH_MASTER_KEY=xxx
MEILISEARCH_SEARCH_KEY=yyy
```

### 옵션 B: Fly.io에서 self-host

```bash
# Dockerfile 생성 (Meilisearch 공식 이미지)
cat > packages/search/Dockerfile << 'EOF'
FROM getmeili/meilisearch:latest
CMD ["meilisearch", "--http-addr", "0.0.0.0:7700"]
EOF

# Fly 앱 초기화
flyctl launch --no-deploy --name mft-search

# fly.toml 수정
cat > fly.toml << 'EOF'
app = "mft-search"
primary_region = "nrt"

[build]
dockerfile = "packages/search/Dockerfile"

[[services]]
ports = [{handlers = ["http"], port = 80}]
internal_port = 7700

[vm]
size = "shared-cpu-1x"
memory = "512mb"
EOF

# 배포
flyctl deploy

# 환경 변수 저장
MEILISEARCH_HOST=https://mft-search.fly.dev
MEILISEARCH_MASTER_KEY=<generate-secure-string>
MEILISEARCH_SEARCH_KEY=<public-key>
```

---

## 단계 2: 인덱스 정의

Meilisearch는 각 엔티티별로 별도 인덱스 생성.

```bash
# Master key로 인증 필요
MASTER_KEY="xxx"
HOST="https://mft-search.fly.dev"

# 인덱스 생성: artists
curl -X POST "$HOST/indexes" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "artists",
    "primaryKey": "id"
  }'

# 인덱스 생성: shows
curl -X POST "$HOST/indexes" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "shows",
    "primaryKey": "id"
  }'

# 인덱스 생성: festivals
curl -X POST "$HOST/indexes" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "festivals",
    "primaryKey": "id"
  }'

# 검색 설정 (한국어 형태소 분석)
# Meilisearch는 기본적으로 CJK(중일한) 토크나이저 포함
curl -X PATCH "$HOST/indexes/shows/settings" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": ["title", "artists", "venue", "date"],
    "displayedAttributes": ["id", "title", "artists", "venue", "date", "completeness"],
    "filterableAttributes": ["date", "completeness", "festivalId"],
    "sortableAttributes": ["date", "completeness"]
  }'

# festivals, artists도 유사하게 설정
curl -X PATCH "$HOST/indexes/festivals/settings" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": ["name", "aliases", "locationText"],
    "filterableAttributes": ["startDate"]
  }'

curl -X PATCH "$HOST/indexes/artists/settings" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": ["canonicalName", "aliases"]
  }'
```

---

## 단계 3: 데이터 마이그레이션

### 3.1 검색 어댑터 구현

`packages/search/adapters/meilisearch.ts` 생성:

```typescript
// packages/search/adapters/meilisearch.ts
import { MeiliSearch } from 'meilisearch';

export interface MeilisearchConfig {
  host: string;
  apiKey: string;  // Master key for indexing, Search key for queries
}

export class MeilisearchEngine implements SearchEngine {
  private client: MeiliSearch;

  constructor(config: MeilisearchConfig) {
    this.client = new MeiliSearch({
      host: config.host,
      apiKey: config.apiKey,
    });
  }

  async search(query: string, opts?: SearchOptions) {
    const results = await this.client.multiSearch({
      queries: [
        {
          indexUid: 'shows',
          q: query,
          limit: 20,
          sort: ['completeness:desc', '_score:desc'],
        },
        {
          indexUid: 'festivals',
          q: query,
          limit: 20,
        },
        {
          indexUid: 'artists',
          q: query,
          limit: 20,
        },
      ],
    });

    // AC-8 context-aware result aggregation
    return {
      shows: results.results[0].hits,
      festivals: results.results[1].hits,
      artists: results.results[2].hits,
    };
  }

  async indexShow(show: any) {
    await this.client.index('shows').addDocuments([show]);
  }

  async indexFestival(festival: any) {
    await this.client.index('festivals').addDocuments([festival]);
  }

  async indexArtist(artist: any) {
    await this.client.index('artists').addDocuments([artist]);
  }

  // Bulk operations
  async bulkIndexShows(shows: any[]) {
    await this.client.index('shows').addDocuments(shows, { primaryKey: 'id' });
  }

  async bulkIndexFestivals(festivals: any[]) {
    await this.client.index('festivals').addDocuments(festivals, { primaryKey: 'id' });
  }

  async bulkIndexArtists(artists: any[]) {
    await this.client.index('artists').addDocuments(artists, { primaryKey: 'id' });
  }
}
```

### 3.2 초기 백필 스크립트

`packages/crawler/scripts/backfill-meilisearch.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { MeilisearchEngine } from '../../search/adapters/meilisearch';

const prisma = new PrismaClient();
const meilisearch = new MeilisearchEngine({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_MASTER_KEY!,
});

async function backfill() {
  console.log('Starting Meilisearch backfill...');

  // 모든 Shows 색인
  const shows = await prisma.show.findMany({
    include: { artists: true, venue: true, festival: true },
  });
  console.log(`Indexing ${shows.length} shows...`);
  await meilisearch.bulkIndexShows(
    shows.map((s) => ({
      id: s.id,
      title: s.title || '',
      artists: s.artists.map((a) => a.canonicalName).join(', '),
      venue: s.venue?.name || '',
      date: s.date?.toISOString().split('T')[0],
      completeness: s.completeness,
      festivalId: s.festivalId,
    }))
  );

  // 모든 Festivals 색인
  const festivals = await prisma.festival.findMany();
  console.log(`Indexing ${festivals.length} festivals...`);
  await meilisearch.bulkIndexFestivals(
    festivals.map((f) => ({
      id: f.id,
      name: f.name,
      aliases: f.aliases.join(', '),
      locationText: f.locationText || '',
      startDate: f.startDate?.toISOString().split('T')[0],
    }))
  );

  // 모든 Artists 색인
  const artists = await prisma.artist.findMany();
  console.log(`Indexing ${artists.length} artists...`);
  await meilisearch.bulkIndexArtists(
    artists.map((a) => ({
      id: a.id,
      canonicalName: a.canonicalName,
      aliases: a.aliases.join(', '),
    }))
  );

  console.log('Backfill complete!');
  await prisma.$disconnect();
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**실행:**
```bash
pnpm tsx packages/crawler/scripts/backfill-meilisearch.ts
```

---

## 단계 4: 동기화 전략

### 옵션 A: 크롤러 run 끝에서 일괄 push

`packages/crawler/src/run.ts`의 끝에서:

```typescript
// 크롤러 완료 후
const searchEngine = new MeilisearchEngine({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_MASTER_KEY!,
});

// 최근 변경된 Shows 색인
const recentShows = await prisma.show.findMany({
  where: { updatedAt: { gte: crawlRun.startedAt } },
  include: { artists: true, venue: true },
});
await searchEngine.bulkIndexShows(recentShows.map(formatShow));

// 최근 변경된 Festivals
const recentFestivals = await prisma.festival.findMany({
  where: { updatedAt: { gte: crawlRun.startedAt } },
});
await searchEngine.bulkIndexFestivals(recentFestivals);

// 최근 변경된 Artists
const recentArtists = await prisma.artist.findMany({
  where: { updatedAt: { gte: crawlRun.startedAt } },
});
await searchEngine.bulkIndexArtists(recentArtists);

console.log('Search index updated.');
```

### 옵션 B: Postgres LISTEN/NOTIFY (고급)

`packages/db/src/listen.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listenChanges() {
  // Postgres LISTEN 설정
  await prisma.$executeRaw`LISTEN show_changed`;
  await prisma.$executeRaw`LISTEN festival_changed`;
  await prisma.$executeRaw`LISTEN artist_changed`;

  // 변경 감지 로직
  // (복잡함 — 크롤러 끝에서 일괄 push 권장)
}
```

---

## 단계 5: 검색 라우트 교체

`apps/web/app/api/search/route.ts`:

```typescript
import { MeilisearchEngine } from '@packages/search/adapters/meilisearch';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const search = new MeilisearchEngine({
    host: process.env.MEILISEARCH_HOST!,
    apiKey: process.env.MEILISEARCH_SEARCH_KEY!,  // 공개 Search key
  });

  try {
    const results = await search.search(q);
    return Response.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

---

## 단계 6: Materialized View 정리 (V2에서)

MV는 더 이상 필요 없으므로 삭제:

```sql
DROP MATERIALIZED VIEW search_index;
DROP INDEX search_index_uniq;
```

**타이밍:** Meilisearch 동기화 확인 후 (최소 24시간 모니터링 후).

---

## 단계 7: 모니터링

마이그레이션 후 7일간 모니터링:

```bash
# Meilisearch 헬스 체크
curl -X GET "https://<meilisearch-host>/health" \
  -H "Authorization: Bearer <API_KEY>"

# 인덱스 통계
curl -X GET "https://<meilisearch-host>/indexes/shows/stats" \
  -H "Authorization: Bearer <API_KEY>"

# 검색 응답 시간 모니터링 (apps/web에서)
# AC-12 p95 측정
const start = performance.now();
const results = await fetch('/api/search?q=잔나비');
const duration = performance.now() - start;
console.log(`Search latency: ${duration}ms`);
```

**목표:** AC-12 p95 < 500ms 달성.

---

## 단계 8: 롤백 계획

문제 발생 시 PostgreSQL FTS로 즉시 복귀:

### 1단계: 검색 어댑터 원위치

`apps/web/app/api/search/route.ts`:

```typescript
// Meilisearch 대신 원래 어댑터 사용
import { PostgresSearchEngine } from '@packages/search/adapters/postgres';

const search = new PostgresSearchEngine();
const results = await search.search(q);
```

### 2단계: Materialized View 재생성

```sql
CREATE MATERIALIZED VIEW search_index AS
SELECT 'show'::text AS kind, s.id::text, s.date::text AS sort_key,
  (coalesce(s.title,'') || ' ' || string_agg(a."canonicalName" || ' ' || array_to_string(a.aliases, ' '), ' ') || ' ' || v.name) AS body
FROM "Show" s
JOIN "Venue" v ON v.id = s."venueId"
LEFT JOIN "_ShowArtists" sa ON sa."A" = s.id
LEFT JOIN "Artist" a ON a.id = sa."B"
GROUP BY s.id, v.name, s.date, s.title
UNION ALL
SELECT 'festival', f.id::text, f."startDate"::text,
  f.name || ' ' || array_to_string(f.aliases, ' ') || ' ' || coalesce(f."locationText",'')
FROM "Festival" f
UNION ALL
SELECT 'artist', a.id::text, NULL,
  a."canonicalName" || ' ' || array_to_string(a.aliases, ' ')
FROM "Artist" a;

CREATE UNIQUE INDEX search_index_uniq ON search_index (kind, id);
-- pgroonga 또는 pg_trgm 인덱스 재활성화
CREATE INDEX search_idx ON search_index USING pgroonga (body);
```

### 3단계: 배포 및 모니터링

```bash
cd apps/web
vercel deploy --prod
```

24시간 모니터링 후 안정 확인.

---

## 문제 해결

| 증상 | 원인 | 해결책 |
|---|---|---|
| Meilisearch 연결 실패 | host/API key 오류 | 환경 변수 재확인, Cloud dashboard 확인 |
| 색인 용량 부족 | 문서 수 초과 | Plan 업그레이드 또는 old 인덱스 삭제 |
| 검색 정확도 저하 | 동기화 지연 | 백필 재실행, LISTEN/NOTIFY 확인 |
| p95 여전히 > 500ms | Meilisearch 느림 | CPU 업그레이드, 또는 분산 쿼리 최적화 |
| 크롤러 timeout | 동기화 과정 느림 | 비동기 queue로 변경 (rabbitmq 등) |

---

## 체크리스트

마이그레이션 완료 후:

- [ ] Meilisearch 인스턴스 프로비저닝 완료
- [ ] 3개 인덱스(artists, shows, festivals) 생성 완료
- [ ] 백필 스크립트 실행, 모든 데이터 색인됨
- [ ] 검색 어댑터 (`packages/search/adapters/meilisearch.ts`) 구현 완료
- [ ] 크롤러 동기화 로직 추가 완료
- [ ] `/api/search` 라우트 Meilisearch 사용으로 변경 완료
- [ ] 7일 모니터링 후 AC-12 p95 < 500ms 확인
- [ ] PostgreSQL FTS 롤백 계획 문서화 완료
- [ ] MV 삭제 (또는 주석 처리)

---

**Document version:** Meilisearch migration runbook v1
**Last updated:** 2026-05-19
**Trigger gate:** AC-23 (MV refresh > 2분 OR search p95 > 800ms OR AC-8 정확도 < 80%)
