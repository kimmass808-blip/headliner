# Plan: 국내 인디 공연·페스티벌 검색·아카이브 플랫폼 (V1 MVP)

## Metadata
- Source spec: `.omc/specs/deep-interview-korean-indie-concert-discovery.md` (v4, 모호도 ~14%)
- Plan version: **v5.1 final — iter 4 양 reviewer APPROVED + LOW polish 흡수**
- Mode: consensus / direct / RALPLAN-DR Short
- Status: **PENDING APPROVAL (v5.1)** — Architect/Critic 합의 완료. 실행 결정은 사용자의 별도 승인 필요
- Risk profile: low — greenfield, no PII, no migration; archive-only fallback
- Iterations: 4 / 5 (v3 합의 → v4 Round 18 patch → v5 iter-3 cascade fix → v5.1 iter-4 LOW polish)

### Review history
- **v1**: Planner initial draft
- **v2**: iteration 1 피드백 흡수 — 6 blocker + 7 major + 9 minor
- **v3**: Architect APPROVED + Critic APPROVED-WITH-RESERVATIONS 후 잔여 minor·major 흡수 + ADR 추가
- **v4**: Round 18 사용자 결정 — (a) 운영 cap `≤30분/주` 폐기·soft target만 (b) 3필드 컷오프 폐기·**Model A 1필드 컷오프**·부분 Show 모델 도입
- **v5**: iter 3 Architect+Critic NEEDS_REVISION 후 patch — Principle #1 guardrail 재서술, Festival.startDate nullable + completeness, AC-5 크롤러 dup-conflict 정책, ShowMergeLog 모델, AC-20 8-조건, AC-21 testable, AC-6c snowball gate, AC-7 tier-then-rank, AC-7b 배지 매핑, AC-16b past-show 탭, AC-1/6b cap 정당화, 보완 큐 mitigation 3단, Follow-ups +4
- **v5.1 (현재)**: iter 4 양 reviewer APPROVED + LOW polish 흡수 — AC-20 (8) aggregation rubric 명확화 (평균 ≥0.90 = ≥27/30 fields), `duplicateOfShowId` self-ref FK 선언 + 인덱스, ShowMergeLog retention 정책 명시 (append-only V1, V2에 prune ADR), 보완 큐 임계 context 노트 (출시 시점 미발동), Phase 2.7에 buried-relevance KPI 추가. **Architect+Critic 양쪽 APPROVED, 합의 완결.**

### v2 → v3 추가 변경 사항
**Architect 신규 발견:**
- **N1** (merge UX rollback): merge 시 `InstagramPost.extractedShowId` re-point + 패자 Show hard delete. AC-5b 보강.
- **N2** (depth-1 lookup 명세화): Phase 1.5에 `sourceSeedHandle`→`SeedAccount` lookup 명시.
- **N3** (`pending` fetch policy): AC-1을 `status IN ('active', 'pending')`로 확장. pending은 per-account cap=5로 probation fetch.
- **N4** (`consecutiveFails` reset): HTTP 200 성공 시 0으로 reset 명시.
- **N5** (`pg_cron` 가용성 spike): Phase 0 spike에 pgroonga와 함께 검증.
- **N6** (merge UX 동시성): `SELECT FOR UPDATE` 트랜잭션 명시.
- **N7 [MAJOR]** (AC-12 latency kill-switch): launch 전 p95 > 800ms면 AC-23 발동, 출시 차단.

**Critic 신규 발견:**
- **#1 [MAJOR]** (AC-19 split): 19a (crawler off, pg_cron on), 19b (둘 다 off — 순수 archive).
- **#2 [MAJOR]** (AC-6e fail 정의): "fail" = HTTP error OR network timeout. HTTP 200 시 reset.
- **#3** (AC-2 tie-break): 정확도 CI 겹침 시 GPT-4o-mini 기본.
- **#4** (`rejected` 재 mention): V2 awareness 노트.
- **#5** (fingerprint sort 잠금): code-unit sort 사용 명시.
- **#6** (canonicalKey 충돌 감지): V2 awareness 노트.
- **#7** (AC-6c 언어 명확화): "operator-seeded만 snowball, snowball-added는 더 이상 snowball 안 함".
- **#8** (LLM eval 적대적 샘플): 120 샘플 중 ≥10% adversarial.

---

## Requirements Summary

전국 인디 공연·페스티벌 정보를 IG 자동 크롤링으로 수집·정규화하고, 익명 공개 검색 + 사이트 내 상세 페이지 + 운영자 admin(셋리스트·시드 관리·필드 보정)을 제공한다. V1은 IG 단일 소스, archive-only fallback. 운영 부담 ≤30분/주가 최상위 목표.

---

## RALPLAN-DR Summary (Short Mode)

### Principles (5)
1. **운영 지속 가능성 = guardrail (priority 아님, floor)** — v5 재서술. 운영자 손이 *정당화 없이* 늘어나는 결정은 거부. 단 커버리지 목적이 명확하면 노동 도입 허용 (cap 폐기). 1순위 priority는 Drivers 섹션에서 별도 정의.
2. **Archive-graceful** — 크롤러와 웹은 동일 DB만 공유. 검색 인덱스 refresh도 크롤러와 독립 (pg_cron).
3. **최소 표면적** — 단일 Vercel 프로젝트 + Supabase + 운영자-only 외부 알림. 사용자-경로 외부 의존 0.
4. **사용자 익명, 운영자 최소 인증** — 엔드유저 회원 없음. Admin은 단일 ENV password.
5. **데이터 모델은 V2 확장 여지 보존** — Stable URL, optional FK, dedup key가 admin 보정·소스 다양화에 견디게.

### Decision Drivers (Top 3, v4 재정렬)
1. **정보 커버리지** (정보 최대한 많이 — Round 18 사용자 결정) — 운영 cap 폐기 후 1순위로 승격
2. **IG 단일 소스 신뢰성** — 차단 가능성 상존 (archive-only fallback 유지)
3. **한국어 검색 정확도** — 인디 아티스트명 한영 혼용·alias, **completeness 가중**으로 미완 카드 상단 점거 방지

운영 부담은 soft target (Hard cap 폐기, 운영자 재량). 여전히 design 결정에서 "정당화 없는 운영 노동 도입"은 거부.

### Viable Options 비교

| 결정 | Option A (채택) | Option B (대안) | 근거 |
|---|---|---|---|
| **호스팅 토폴로지** | All-in-Vercel: Web + Vercel Cron 크롤러 + Supabase | Vercel web + Fly.io shared-cpu-1x 크롤러 | A: 인프라 1개. **단, 5분 timeout cliff 도달 시 Phase 4 트리거로 B 마이그레이션** (AC-22) |
| **DB + 검색** | Supabase Postgres + FTS (spike 결과 분기) | Postgres + Meilisearch 별도 | A: Phase 0 spike에서 Korean tokenization 검증 후 확정. pgroonga 가능 시 채택, 불가 시 pg_trgm+alias 또는 Meilisearch 분기 |
| **LLM** | **120 head-to-head 평가 후 결정** | mini OR Haiku | A: GPT-4o-mini 단가 ~5× 저렴 ($0.15/$0.80 input/1M). cost-per-correct-extraction 우위 모델 채택. CI 겹침 시 mini 기본 |
| **Admin 인증** | 단일 ENV password + jose JWT | Magic-link | A: 운영자 1인. 사용자-경로 외부 의존 없음. Discord(알림)는 사용자-경로 아님 — 카테고리 다름 |
| **MV refresh 위치** | Supabase pg_cron (15분 주기) | 크롤러 cron 끝에서 호출 | A: 크롤러↔웹 격리. 크롤러 실패가 검색 staleness 유발 안 함 (Principle 2) |
| **모노레포 도구** | pnpm workspaces only | + Turborepo | A: 빌드 캐시 V2 |

**대안 invalidation 노트:**
- **Cloudflare Workers (크롤러)**: 30s CPU 한도. LLM 배치 부적합.
- **GitHub Actions Cron**: ephemeral IP 풀이 IG 정중함 측면에서 불리.
- **Auth providers (Auth.js, Clerk)**: 엔드유저 인증 없는 V1에 미사용. jose JWT 1 lib vs 4+ deps.
- **Magic-link**: 운영자-only 흐름에 외부 메일 서비스 도입 가치 없음. Discord는 알림(write-only).

---

## 기술 스택 결정 (확정 + 조건부)

| 영역 | 선택 | 비고 |
|---|---|---|
| 모노레포 | pnpm workspaces | |
| 프론트 + API | Next.js 15 (App Router) | RSC, SSG, stable URL, SEO |
| DB | Supabase Postgres | pg_cron + pgroonga(가능 시) |
| ORM | Prisma | |
| Search | **Phase 0 spike 후 확정**: (1) pgroonga (2) pg_trgm + alias (3) Meilisearch | `packages/search/` interface로 추상화 |
| Crawler | Vercel Cron | Phase 4 마이그레이션 트리거 명시 (AC-22) |
| LLM (정규화) | **Phase 1에 120-sample head-to-head 후 확정** | 후보: GPT-4o-mini vs Claude Haiku 3.5 |
| Hosting (web) | Vercel | Hobby → Pro 전환: cron 2개 초과 OR 함수 timeout 빈도 |
| Hosting (DB) | Supabase Free → Pro $25/월 | connection·디스크 한도 도달 시 |
| Admin auth | 단일 ENV `ADMIN_PASSWORD` + jose JWT httpOnly cookie (7일) | DB `AdminUser` 테이블 없음 |
| 알림 | Discord webhook | 운영자-only |

### 모노레포 디렉토리 구조 (목표)

```
mft/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/{page.tsx, shows/[id]/, festivals/[id]/}
│       │   ├── (admin)/{login/, seeds/, shows/[id]/, festivals/[id]/, setlists/[showId]/, crawl-runs/}
│       │   └── api/{search/route.ts, cron/crawl/route.ts, admin/...}
│       └── vercel.json
├── packages/
│   ├── db/              # Prisma + migrations
│   ├── normalizer/      # LLM classify + extract
│   ├── crawler/         # IG fetch + dedup + persist + seed-expand
│   ├── search/          # Swappable: postgres-fts | meilisearch | pg_trgm
│   ├── canonicalize/    # venueText, artistName, igUrl, igHandle
│   └── shared/          # zod 스키마
└── pnpm-workspace.yaml
```

### Canonicalization 모듈 (블로커 B1 대응)

`packages/canonicalize/`:
- `canonicalizeVenueText(raw: string): { key: string; display: string }` — 소문자, 공백 압축, alias lookup, 특수문자 제거.
  - 예: "롤링홀", "Rolling Hall", "롤링 홀" → key=`rolling_hall`. `VenueAlias` 테이블로 시드.
- `canonicalizeArtistName(raw: string): { key: string; display: string }` — Artist.aliases lookup.
- `canonicalizeInstagramUrl(url: string): string` — `https://www.instagram.com/p/{shortcode}/`로 정규화. query/fragment 제거.
- `canonicalizeInstagramHandle(raw: string): string | null` — Regex `^@?([a-zA-Z0-9._]{1,30})$`. dots·underscore 허용. 해시태그·이메일·trailing dot edge 처리. 무효면 null.

### Prisma 스키마 (v3)

```prisma
model Artist {
  id            String   @id @default(cuid())
  canonicalName String
  canonicalKey  String   @unique
  aliases       String[]
  igHandle      String?  @unique
  firstSeenAt   DateTime @default(now())
  shows         Show[]   @relation("ShowArtists")
}

model Venue {
  id            String  @id @default(cuid())
  name          String
  canonicalKey  String  @unique
  address       String?
  region        String?
  lat           Float?
  lng           Float?
  shows         Show[]
  festivals     Festival[]
}

model VenueAlias {
  id           String @id @default(cuid())
  canonicalKey String
  alias        String @unique
  addedBy      String  // 'operator' | 'auto'
  @@index([canonicalKey])
}

model Festival {
  id              String    @id @default(cuid())
  name            String
  canonicalKey    String    @unique
  aliases         String[]
  startDate       DateTime? @db.Date  // v5: nullable (Model A 일관성 — partial 게시물 허용)
  endDate         DateTime? @db.Date  // v5: nullable
  venueId         String?
  venue           Venue?    @relation(fields: [venueId], references: [id])
  locationText    String?
  officialUrl     String?
  ticketUrl       String?
  igHandle        String?   @unique
  posterImageUrl  String?
  description     String?
  shows           Show[]
  // v5: completeness 모델 일관 적용
  completeness    Int       @default(0)  // 0~2 (name·startDate · ≥1 Show)
  needsReview     Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@index([startDate, endDate])
  @@index([completeness])
}

// v5: 합병 이력 추적 (Critic MAJOR — AC-5b 보강).
// v5.1 retention 정책: append-only. V1 scale (≤500 merges/year 추정)에서 cleanup 불필요. row count >10k에 도달하면 V2에 archive·prune ADR 추가.
model ShowMergeLog {
  id          String   @id @default(cuid())
  winnerId    String   // 살아남은 Show
  loserData   Json     // 패자 Show 스냅샷 (artist ids, fingerprint, dates 등)
  mergedAt    DateTime @default(now())
  mergedBy    String   // 'operator' | 'crawler-auto'
  reason      String?  // 'admin-edit-promotion' | 'crawler-fingerprint-conflict' | etc
  @@index([winnerId])
  @@index([mergedAt])
}

model Show {
  id                String    @id @default(cuid())
  date              DateTime? @db.Date  // v4: nullable (Model A)
  startTime         String?
  venueId           String?              // v4: nullable
  venue             Venue?    @relation(fields: [venueId], references: [id])
  artists           Artist[]  @relation("ShowArtists")  // v4: 0개여도 OK
  title             String?
  originalPostUrl   String    @unique    // v4: 자연 키 (1 IG post → 1 Show)
  ticketUrl         String?
  imageUrl          String?
  rawTextExcerpt    String?   @db.Text
  festivalId        String?
  festival          Festival? @relation(fields: [festivalId], references: [id])
  stage             String?
  setOrder          Int?
  setlist           Setlist?
  // v4: completeness 모델
  completeness      Int       @default(0)  // 0~3 (date·venue·artists≥1)
  missingFields     String[]               // ['date'|'venue'|'artists'] 부분집합
  needsReview       Boolean   @default(true)  // admin 보완 큐 필터
  fingerprint       String?   @unique  // v4: nullable, completeness=3에 도달하면 생성
  fingerprintInputs Json?                  // v4: nullable
  duplicateOfShowId String?                // v5: 크롤러 dup 감지 시 winner 가리킴, admin 확인 대기
  duplicateOf       Show?     @relation("DuplicateOf", fields: [duplicateOfShowId], references: [id])  // v5.1 self-ref FK
  duplicates        Show[]    @relation("DuplicateOf")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([date])
  @@index([festivalId])
  @@index([completeness, date])  // v4: 검색 랭킹·관리자 큐 정렬용
  @@index([duplicateOfShowId])    // v5.1: '중복 후보' 탭 쿼리
}

model Setlist {
  id          String   @id @default(cuid())
  showId      String   @unique
  show        Show     @relation(fields: [showId], references: [id], onDelete: Cascade)
  sourceNotes String?
  songs       Song[]
  updatedAt   DateTime @updatedAt
}

model Song {
  id        String  @id @default(cuid())
  setlistId String
  setlist   Setlist @relation(fields: [setlistId], references: [id], onDelete: Cascade)
  title     String
  order     Int
  isEncore  Boolean @default(false)
  coverOf   String?
  @@index([setlistId, order])
}

model InstagramPost {
  canonicalUrl        String   @id
  sourceAccount       String
  postedAt            DateTime
  rawText             String   @db.Text
  imageUrls           String[]
  postType            String   // 'single_show' | 'festival_lineup' | 'setlist' | 'unrelated'
  extractedShowId     String?
  extractedFestivalId String?
  fetchedAt           DateTime @default(now())
  @@index([sourceAccount, postedAt])
}

model SeedAccount {
  igHandle         String    @id  // canonical
  kind             String    // 'festival' | 'artist' | 'venue'
  status           String    // 'pending' | 'active' | 'dead' | 'rejected'
  addedBy          String    // 'operator' | 'snowball'
  sourceSeedHandle String?   // snowball provenance — references SeedAccount.igHandle
  addedAt          DateTime  @default(now())
  promotedAt       DateTime?
  lastFetched      DateTime?
  consecutiveFails Int       @default(0)
  removedAt        DateTime?
  @@index([status, lastFetched])
}

model CrawlRun {
  id                String   @id @default(cuid())
  startedAt         DateTime @default(now())
  finishedAt        DateTime?
  status            String   // 'running' | 'success' | 'partial' | 'failed' | 'blocked_suspected'
  accountsAttempted Int      @default(0)
  accountsSucceeded Int      @default(0)
  postsFetched      Int      @default(0)
  postsClassified   Int      @default(0)
  showsCreated      Int      @default(0)
  showsUpdated      Int      @default(0)
  festivalsCreated  Int      @default(0)
  snowballAdded     Int      @default(0)
  llmTokensIn       Int      @default(0)
  llmTokensOut      Int      @default(0)
  llmCostCents      Int      @default(0)
  durationMs        Int?
  errors            Json?
  @@index([startedAt])
}
```

**No `AdminUser` table.** ENV `ADMIN_PASSWORD` + jose JWT 단일 인증 경로.

### Fingerprint v3 (블로커 B1/B6 + Critic #5 대응)

```ts
// packages/crawler/src/fingerprint.ts
import { createHash } from 'crypto';

export function computeShowFingerprint(input: {
  dateIso: string;                  // 'YYYY-MM-DD'
  venueCanonicalKey: string;        // from canonicalizeVenueText
  artistCanonicalKeys: string[];    // pre-sort applied here
}): string {
  // 명시적 code-unit sort (locale-independent, deterministic across runtimes)
  const sorted = [...input.artistCanonicalKeys].sort();
  const payload = `${input.dateIso}|${input.venueCanonicalKey}|${sorted.join(',')}`;
  return createHash('sha256').update(payload).digest('hex');
}
```

**Crawler 적재**: rawText → canonicalize → fingerprint → upsert by fingerprint. Venue·Artist는 canonicalKey upsert.

**Admin 보정 (artist list 변경)**:
1. `BEGIN TRANSACTION`
2. `SELECT * FROM "Show" WHERE id = $1 FOR UPDATE`  ← **N6 대응: 동시성 lock**
3. fingerprintInputs 재계산 → 새 fingerprint
4. `SELECT * FROM "Show" WHERE fingerprint = $newFp FOR UPDATE`
5. 충돌 없음 → 단순 UPDATE
6. 충돌 있음 → **merge UX**:
   - 운영자에게 "Show X와 동일해집니다. 병합/취소?" 확인
   - **병합 선택 시 (N1 대응)**: 패자 Show 결정 → setlist 비어있지 않은 쪽 우선 → `UPDATE "InstagramPost" SET "extractedShowId" = $survivor WHERE "extractedShowId" = $loser` → 패자 Show hard delete (Setlist cascade) → 승자 Show.fingerprint 재기록
   - 취소 시 보정 롤백 (`ROLLBACK`)

### MV 정의 (pgroonga 채택 가정; spike 결과에 따라 인덱스 부분 변형)

```sql
-- packages/db/prisma/migrations/<n>_search_index/migration.sql

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

CREATE UNIQUE INDEX search_index_uniq ON search_index (kind, id);  -- CONCURRENTLY 필수
-- pgroonga 가능: CREATE INDEX search_idx ON search_index USING pgroonga (body);
-- pg_trgm fallback: CREATE INDEX search_idx ON search_index USING gin (body gin_trgm_ops);
```

**Refresh (Supabase pg_cron)**:
```sql
SELECT cron.schedule('refresh-search', '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY search_index$$);
```

---

## Acceptance Criteria (v3 — 31 ACs, 모두 testable)

### Phase 0 (spike & bootstrap)
- [ ] **AC-0**: `docs/phase0-search-spike.md` 작성 — 채택된 엔진(pgroonga | pg_trgm | meilisearch) + **pg_cron 가용성 확인 결과** 명시. (N5 흡수)

### 데이터 파이프라인
- [ ] **AC-1** (v5 cap 정당화): Vercel Cron(매 6h) 호출 시 `SeedAccount.status IN ('active', 'pending')` 계정 순회. active = ≤50 posts/account, pending = ≤5 posts/account (probation cap). 마지막 성공 fetch 이후 새 게시물만. `SeedAccount.lastFetched`로 추적. **Cap 정당화 (v5)**: 운영 burden 때문이 아니라 (1) Vercel Cron 5분 timeout 안에서 LLM 호출 배치 처리 가능 수치 + (2) IG 정중함(같은 계정 과도한 fetch 방지). 커버리지 driver 하에서도 timeout cliff 회피를 위해 유지. PoC 데이터 후 재튜닝 candidate.
- [ ] **AC-2**: 분류기 head-to-head 120-sample 평가에서 cost-per-correct-extraction 우위 모델 채택. 양쪽 정확도 ≥80%, 95% CI half-width 표기. **120 중 ≥12개는 adversarial (truncated, multilingual, emoji-heavy, 노이즈)**. **정확도 CI 겹침 + cost-per-correct 차이 ≤10%면 GPT-4o-mini 기본 (Option A).** (Critic #3/#8 흡수)
- [ ] **AC-3** (v4 rewrite): 단독공연 게시물에서 date·venue·artist 3필드를 best-effort 추출. **최소 1필드** (date OR venue OR artist≥1) 잡히면 Show 생성. canonicalize 후 적재. 게시 컷오프는 `completeness ≥ 1`. 0개 잡힌 게시물은 `InstagramPost`만 저장 (Show 미생성).
- [ ] **AC-3b** (v4, v5 명시화): Show 생성·갱신 시 `completeness`(0~3) 계산 = `date IS NOT NULL` + `venue IS NOT NULL` + `artists.length ≥ 1`. `missingFields`에 누락 필드 라벨 저장. `needsReview = completeness < 3`. **V1 trade-off 명시**: `artists.length ≥ 1`은 binary bit이라 "1/50 부분 라인업"과 "1/1 완성"이 같은 점수. 페스티벌 컨텍스트에서 의미 있게 구분하려면 V2에 `artistsExpected` (LLM 추정 라인업 크기) + `artistsCompletenessRatio` 도입 — Follow-up에 명시. (Critic MAJOR 흡수)
- [ ] **AC-4** (v5 rewrite): 페스티벌 라인업 게시물에서 `Festival 1 + Show N` 생성. Festival도 partial 가능 — `name`만 잡혀도 Festival 생성 (`startDate=null`이면 Festival.completeness=0 또는 1, needsReview=true). Festival.startDate가 있으면 Show.date 상속(없으면 Show.date=null), Festival.locationText/venue가 있으면 Show.venue 상속. 즉 Festival도, set Show도 모두 Model A 1-필드 컷오프 통과 가능. stage·setOrder는 best-effort, 빠지면 null로 적재, admin 보정 큐. (Architect HIGH-1 흡수)
- [ ] **AC-5** (v4 rewrite, v5 보강): Show identity는 `originalPostUrl` UNIQUE (자연 키). `fingerprint`는 `completeness = 3` 도달 시점에만 계산: `sha256(date_iso + venue.canonicalKey + sorted_artist_canonicalKeys.join(','))`. code-unit 정렬. fingerprintInputs(JSON)에 컴포넌트 저장. completeness < 3 동안 fingerprint·fingerprintInputs는 null.
  - **v5: 크롤러 자동 경로의 fingerprint 충돌 처리** (Architect HIGH-2 흡수): 크롤러가 새 Show를 promote할 때 fingerprint upsert가 unique conflict 발생 시 — 즉시 hard merge 안 함. 대신 (a) 새 Show는 `needsReview=true` + `duplicateOfShowId=<기존 winner>` 마킹 (Show 모델에 새 필드 추가) (b) Discord webhook 알림 (c) `/admin/incomplete`의 별도 탭 "중복 후보"에 노출. 운영자가 확인 후 admin merge UX 발동. 자동 hard merge는 금지 (잘못 합쳐지면 복구 불가).
- [ ] **AC-5b** (v4 rewrite, v5 보강): Admin이 필드 보완 또는 artist 변경 → completeness 재계산 → 3 도달 시 fingerprint 생성 → 기존 동일 fingerprint Show 존재 시 merge UX. 병합 선택 시 (a) `InstagramPost.extractedShowId` 패자→승자 re-point (b) **`ShowMergeLog` 행 생성 (winnerId, loserData JSON 스냅샷, mergedBy='operator', reason)** (c) 패자 Show hard delete (d) 승자 fingerprint 재기록. 전체 트랜잭션 `SELECT FOR UPDATE` lock. (Critic MAJOR — history loss 흡수)
- [ ] **AC-6**: 페스티벌 라인업 게시물의 `@handle`을 `canonicalizeInstagramHandle` regex로 파싱 → `SeedAccount(status='pending', addedBy='snowball', sourceSeedHandle=<festival>)` 추가. 이미 존재(어떤 status든) 시 건너뜀.
- [ ] **AC-6b** (v5 cap 정당화): 한 배치에서 snowball promotions ≤5건. 초과 시 다음 배치로 이월. **Cap 정당화 (v5)**: 운영 burden 때문이 아니라 (1) snowball 폭증 / spam 핸들 anti-abuse + (2) Vercel Cron 5분 안 LLM 호출 폭증 방지. 커버리지 driver 하에선 PoC 후 데이터 기반 cap 상향 검토 (ADR Follow-up에 명시).
- [ ] **AC-6c** (v5 보강): **운영자가 시드한(`addedBy='operator'`) 계정의 게시물에서, 그리고 그 게시물의 `extractedFestivalId IS NOT NULL`인 경우에만** snowball 발생. 즉 Festival row가 실제로 만들어진 lineup 게시물만 정당한 시드원으로 인정. 단순히 페스티벌-분류만 받았지만 Festival 추출 실패한 게시물은 snowball 트리거 안 함. snowball로 추가된 계정의 게시물에서 발견된 핸들은 무시. (Critic #7, Architect N2 + LOW-1 흡수)
- [ ] **AC-6d**: `pending` → `active` 승급 조건: (1) 1회 fetch 성공 (HTTP 200) (2) ≥1 post 수집 성공 (3) 최근 90일 안에 게시물 있음. 미충족이면 admin 검토 큐로.
- [ ] **AC-6e**: `consecutiveFails` 증가 조건: HTTP error (4xx/5xx) **OR** network timeout. HTTP 200 응답 시 (게시물 수와 무관) **`consecutiveFails = 0` reset**. 3회 연속 도달 시 `status = 'dead'`. (Critic #2, Architect N4 흡수)
- [ ] **AC-6f**: 운영자가 admin에서 pending → active/rejected 일괄 처리 가능.
- [ ] **AC-6g**: V2 awareness 노트 — `rejected` 계정이 6개월 후 다른 페스티벌에 다시 mention되어도 자동 부활 없음. 운영자가 수동으로 status 변경 필요. (Critic #4)

### Search & 공개 웹
- [ ] **AC-7** (v5 보강): `/api/search?q=`가 Artist·Show·Festival 다 indexed에서 검색. `packages/search/SearchEngine` interface로 호출. **Show 결과는 2단 정렬**: 1차 `(completeness = 3) DESC` (tier), 2차 `final_score DESC` where `final_score = ts_rank × completeness_weight` (1→0.5x, 2→0.75x, 3→1.0x). 즉 완성 Show는 항상 미완보다 위에 옴 (tier guarantee). 미완끼리는 multiplicative bias. (Architect MEDIUM-1 흡수.) Phase 2.7 ground-truth 평가에서 "상위 10개 중 미완 비율" 별도 KPI로 측정, 결과 따라 weight 곡선 0.5/0.75 미세조정.
- [ ] **AC-7b** (v4, v5 보강): 공개 검색 결과의 모든 카드는 기본적으로 노출 (completeness ≥1). Show 카드 배지: `completeness=1` → "정보 부족 · 인스타에서 확인", `completeness=2` → "[누락필드명] 미정", `completeness=3` → 배지 없음. **누락 필드명 한글 매핑** (`packages/shared/missing-field-labels.ts` 단일 출처): `{date: '날짜', venue: '장소', artists: '아티스트'}`. (Critic MINOR 흡수.) 모든 미완 카드는 `originalPostUrl` 링크 prominent. 미완 카드는 시각적 약화 (회색조 보더·살짝 작은 폰트) — Tailwind opacity-80 권고.
- [ ] **AC-8**: 컨텍스트 적응 — 쿼리를 각 kind별 독립 실행, top-1 score 수집.
  - `festival.top.score > artist.top.score * 1.5` AND 쿼리 token이 `festival.canonicalKey` 또는 `aliases` 부분 매칭 → **festival mode** (Festival 카드 상단, 그 Festival의 Shows 결과에서 필터아웃).
  - `artist.top.score > festival.top.score * 1.5` AND 쿼리 token이 `artist.canonicalKey` 부분 매칭 → **artist mode** (Shows 명단 + 페스티벌 set 배지).
  - 그 외 → **mixed** (Show + Festival 카드 시각적 구분).
- [ ] **AC-9/10**: 상세 페이지 콘텐츠 동일 (Show: 날짜·장소·아티스트·IG 원문·티켓·셋리스트·부모 Festival 링크 / Festival: 이름·기간·라인업 Day×Stage).
- [ ] **AC-11**: 지난 공연·페스티벌 기본 검색 결과 포함.
- [ ] **AC-12**: 검색 응답 p95 ≤ 500ms. AC-20 출시 시드 충족 후 실측. **만약 p95 > 800ms로 측정되면 출시 차단, AC-23 (Meilisearch 전환 검토) 즉시 발동**. (N7 흡수)

### Admin
- [ ] **AC-13**: `/admin/login`에서 ENV `ADMIN_PASSWORD` bcrypt 비교 → 성공 시 jose JWT (HS256, 7일) httpOnly Secure SameSite=Strict 발급.
- [ ] **AC-14**: `/admin/seeds`에서 리스트 + 필터(status, kind, addedBy) + 일괄 status 변경.
- [ ] **AC-15**: `/admin/setlists/[showId]`에서 곡 CRUD, 순서 dnd-kit 변경, 앵콜·cover_of.
- [ ] **AC-16**: `/admin/shows/[id]` + `/admin/festivals/[id]` 보정 폼. 필드 추가/변경 → completeness 재계산 + AC-5b merge UX 트리거.
- [ ] **AC-16b** (v4, v5 보강): `/admin/incomplete` 페이지 — `Show.needsReview = true` 항목 리스트. **3개 탭**: (1) "예정 공연" — date IS NULL OR date ≥ today, 임박 순. (2) "지난 공연" — date < today, createdAt 최신순. (3) "중복 후보" — `duplicateOfShowId IS NOT NULL`, 운영자가 merge 결정 대기. 필터: 누락 필드별 (date/venue/artists). 각 카드는 IG 원문 미리보기 + 3-필드 입력 폼 inline. 보완·저장 시 completeness 재계산. **운영자 ROI 가이드**: 예정 공연 탭은 발견 가치 큼 (사용자가 보고 갈 수 있는 공연), 지난 공연 탭은 아카이브 가치 큼이지만 사용자 임팩트 낮음 → 운영자 우선순위 안내 메시지로 표시. (Critic MINOR + Architect 흡수)
- [ ] **AC-17**: 미인증 admin 요청 401 (`middleware.ts`).
- [ ] **AC-17b**: `/admin/crawl-runs`에서 최근 50 CrawlRun 표시.

### 운영 / 회복성
- [ ] **AC-18**: CrawlRun.status='blocked_suspected' 트리거 = 한 배치 `accountsAttempted` 중 HTTP 40x/429 응답률 ≥50% **AND** 24h rolling window에 같은 시그널 ≥2회. Discord webhook 알림.
- [ ] **AC-19a**: 크롤러 cron route 7일 비활성 + pg_cron 정상 → `/`, `/shows/*`, `/festivals/*`, `/api/search` 모두 200. 검색은 마지막 MV refresh 시점 데이터로 정상 응답. (N+1 = Critic #1)
- [ ] **AC-19b**: 크롤러 cron + pg_cron 둘 다 비활성 → 동일하게 모두 200, 검색은 그 시점 stale MV로 응답. **순수 archive 모드 확인.** (Critic #1)
- [ ] **AC-20** (v4, v5 rewrite — gameability 보강): 출시 정의 — **8-조건 동시 충족**: (1) Festival ≥3, **그 중 ≥3개가 distinct (같은 festival 중복 제외)**. (2) 전체 Show ≥100 (partial 포함). (3) 완성(`completeness=3`) Show ≥30. (4) **완성 Show 중 ≥15개가 future-dated (date ≥ today)** — 사용자가 실제 갈 수 있는 공연. (5) Artist ≥30. (6) 20개 manual annotated 검색어에 대한 AC-8 분기 정확도 ≥80%. (7) **Show를 contribute한 distinct festival ≥3** (single-festival snowball만으로는 충족 불가). (8) **완성 Show 30건 중 무작위 10건의 IG 원문 대조 extraction correctness — 10건 평균 점수 ≥0.90** (= 30 fields 중 ≥27 correct). 1건당 3필드 모두 맞으면 1.0, 1개 틀리면 0.67, 2개 틀리면 0.33. LLM 환각 검출 게이트. (Critic + Architect MEDIUM-2 흡수; v5.1 aggregation 명확화)
- [ ] **AC-21** (v5 rewrite — vestigial 제거): 운영자 timesheet `docs/ops-log.md` 파일이 **출시 시점 기준 ≥4 주간 entries 존재**. testable 술어. Hard cap 없음 (Round 18 결정) — 내용·시간 합계는 평가 기준 아님. 파일 존재·entry 개수만 게이트. (Critic MAJOR — vestigial 흡수)

### 마이그레이션 트리거
- [ ] **AC-22**: CrawlRun.durationMs > 4분 2회 연속 → Fly.io 마이그레이션 runbook 발동.
- [ ] **AC-23**: MV refresh > 2분 OR search p95 > 800ms → Meilisearch 전환 검토 발동.

---

## Implementation Steps

### Phase 0: Bootstrap + Spikes (Day 0-3)
0.1. pnpm workspaces 스캐폴드 + `apps/web` Next.js 15 init + Tailwind.
0.2. `packages/db` Prisma init, schema.prisma 작성, 첫 migration.
0.3. **Search + pg_cron spike**: Supabase 새 프로젝트, `CREATE EXTENSION pgroonga`, `CREATE EXTENSION pg_cron` 양쪽 시도. 가능 여부·인덱스 정의·샘플 쿼리·cron schedule을 `docs/phase0-search-spike.md`에 기록. 채택 옵션 확정.
0.4. **Search 어댑터**: `packages/search/`에 채택 엔진 어댑터 + `SearchEngine` interface.
0.5. `packages/canonicalize/` 4 함수 + 초기 alias JSON 50건.
0.6. ENV 템플릿: `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`(bcrypt hash), `ADMIN_JWT_SECRET`, `DISCORD_WEBHOOK_URL`.

### Phase 1: Crawler + Normalizer + Eval (Week 1-2)
1.1. `packages/crawler/src/ig-fetch.ts` — IG 공개 데이터 fetch. oEmbed 우선 시도 → fallback HTML + cheerio. 차단·에러 카운트 + log. UA 1개 고정.
1.2. `packages/normalizer/src/classify.ts` — LLM 분류기. zod 검증.
1.3. `packages/normalizer/src/extract-show.ts` + `extract-festival.ts` — 추출. zod 강제.
1.4. `packages/canonicalize/` 적용 + `packages/crawler/src/dedup.ts` fingerprint upsert.
1.5. `packages/crawler/src/seed-expand.ts` — `@handle` 파싱 + status lifecycle + ≤5/배치 cap + depth=1 cap. **N2: 매 mention 처리 시 `SELECT * FROM "SeedAccount" WHERE "igHandle" = $sourceSeedHandle` 로 lookup → `addedBy='snowball'`이면 skip**. consecutiveFails reset 로직 포함 (HTTP 200 시 0).
1.6. `packages/crawler/src/run.ts` — entry. 5분 timeout 안 1배치. CrawlRun row 시작/종료 update.
1.7. **120-sample LLM eval** (`docs/phase1-llm-eval.md`):
   - 120개 IG 게시물 manual annotate (label + 추출 정답). **≥12개 adversarial** (truncated, multilingual, emoji-heavy, 노이즈, ambiguous).
   - GPT-4o-mini + Claude Haiku 3.5 동일 prompt로 실행.
   - 정확도 + cost-per-correct-extraction + 95% CI half-width.
   - 우위 모델 채택. CI 겹침 + cost ≤10% 차이면 mini 기본.
1.8. **PoC 검증**: 페스티벌 IG 3개 입력 → cron 수동 호출 → Festival·Show·SeedAccount(pending) 생성 확인.

### Phase 2: 검색 + 공개 웹 (Week 3-5)
2.1. `packages/db/prisma/migrations/<n>_search_index/migration.sql` — MV + unique index + 엔진별 검색 인덱스.
2.2. Supabase pg_cron 등록: `cron.schedule(...)` 15분 주기 refresh.
2.3. `apps/web/app/api/search/route.ts` — `SearchEngine` 사용. AC-8 entity-type-aware 별도 쿼리 + 1.5× tie-break + token gate.
2.4. `apps/web/app/(public)/page.tsx` — 검색 + 카드 3종.
2.5. `apps/web/app/(public)/shows/[id]/` + `festivals/[id]/` — SSG/ISR.
2.6. SEO 메타·sitemap·robots.
2.7. **검색 ground-truth 평가** (`docs/phase2-search-eval.md`): 20개 manual annotated 쿼리 → AC-8 분기 정확도. **출시 직전 p95 측정 → AC-12 800ms 게이트.** **v5.1 보강 KPI**: (a) 상위 10개 결과 중 미완 카드 비율 (목표 ≤40%) (b) **buried high-relevance partial** 케이스 — 정답 카드가 partial일 때 tier-then-rank로 inferior complete 아래 묻히는 비율 (목표 ≤10%). 임계 초과 시 AC-7 weight 곡선 0.5/0.75 미세조정 또는 tier guarantee 완화 검토.

### Phase 3: Admin (Week 6-7)
3.1. `apps/web/middleware.ts` — JWT 쿠키 검증, 모든 `/admin/*` 라우트 보호.
3.2. `/admin/login/page.tsx` — ENV password 비교.
3.3. `/admin/seeds/page.tsx` — SeedAccount 리스트, status 일괄 변경, pending 승급 큐.
3.4. `/admin/setlists/[showId]/page.tsx` — Song CRUD + dnd-kit.
3.5. `/admin/shows/[id]/` + `/admin/festivals/[id]/` — 보정 폼, AC-5b merge UX (SELECT FOR UPDATE 트랜잭션).
3.6. `/admin/crawl-runs/page.tsx` — CrawlRun 관측.

### Phase 4: 회복성 + 출시 (Week 8)
4.1. `apps/web/lib/notify.ts` — Discord webhook 헬퍼.
4.2. CrawlRun blocked_suspected 검출 + rolling window 계산 + 알림.
4.3. `vercel.json` cron (`0 */6 * * *`).
4.4. **마이그레이션 runbook 2개**: `docs/runbooks/fly-migration.md`, `docs/runbooks/meilisearch-migration.md`.
4.5. 출시 시드: 페스티벌 IG 5-10개 → 3-7일 운영 → AC-20 **8-조건** + AC-12 p95 측정. AC-20 condition (8) correctness eval은 무작위 10건 IG 원문 대조 sampling.
4.6. AC-19a + AC-19b 시나리오 테스트.
4.7. 운영자 timesheet 첫 4주 기록.

---

## Risks and Mitigations (모두 concrete + 측정 트리거)

| 리스크 | 트리거 (측정) | 완화책 |
|---|---|---|
| IG 공개 HTML 구조 변경 | `ig-fetch` 셀렉터 매칭률 < 80% | 셀렉터 모듈화 + 임계 미달 Discord 알림 + oEmbed fallback + archive graceful |
| IG 차단 | HTTP 40x/429 ≥50% rolling 24h | 알림 + 크롤러 cron 자동 일시정지 + admin "재개" UI. 우회 evasion 없음 |
| LLM 추출 정확도 부족 | 120-sample 정확도 < 80% (양쪽) | prompt iterate → ensemble vote → 운영자 입력 비율↑ → 80% 미만 게시물 자동 폐기 |
| Snowball 폭증 | 한 배치 추가 시도 > 50 | AC-6b/c hard cap. 초과 Discord 알림 + admin 강제 검토 |
| Dead 계정 누적 | consecutiveFails ≥3, 일 단위 ≥10건 | AC-6e 자동 dead 전환. admin 일괄 정리 |
| 검색 한국어 만족도 부족 | AC-20 ground-truth 정확도 < 80% | Meilisearch runbook (AC-23) |
| Search p95 부족 | AC-12 측정 p95 > 800ms | **출시 차단** + AC-23 즉시 발동 |
| Vercel Cron 5분 timeout | durationMs > 4분 2회 연속 | Fly.io runbook (AC-22) |
| MV refresh 슬로우 | pg_cron refresh > 2분 | trigger-based UPDATE 검토 OR Meilisearch 마이그레이션 |
| 운영자 비대응 | pending ≥50건 7일 이상 | Discord 주간 요약. 무대응 시 archive graceful |
| LLM 월 비용 초과 | OpenAI/Anthropic billing $20 alert | 예상 ~$0.5/월 (200계정×5/주×4주×600토큰 × mini 단가). 10× 성장도 <$10/월 |
| MV 스키마 변경 | migration 발생 | DROP + CREATE + full refresh runbook. 유지보수 윈도우 |
| canonicalKey 충돌 (서로 다른 venue가 같은 key) | V2 awareness — V1엔 감지 메커니즘 없음 | 운영자가 admin에서 Venue.name 변경 시 alias 추가로 분리 가능 (Critic #6) |
| **미완 Show로 인한 검색 노이즈** (v4 신규) | AC-20 ground-truth 평가 시 미완 카드가 상위 결과의 ≥40% 점유 | (1) AC-7 completeness 가중 (1/3→0.5x, 2/3→0.75x)으로 자연 후순위 (2) UI에서 미완 카드는 시각적 약화 (회색조·작은 폰트) (3) 임계 초과 시 "기본 결과는 ≥2/3만, '미완 포함' 토글 추가" 옵션 발동 |
| **보완 큐 적체** (v4 신규, v5 mitigation 보강) | `needsReview = true` 카운트 ≥500 + 7일 이상 운영자 미접속 | (1) Discord 주간 요약에 큐 크기 + "예정/지난/중복" 탭별 분포 포함 (2) **back-pressure**: ≥1000 적체 시 신규 partial Show 생성 시 immediate dedup만 적용, classification가 'unrelated'에 가까운 boundary 게시물은 자동 폐기 (LLM 신뢰도 점수 임계 강화) (3) ≥1500 적체 시 snowball 자동 일시정지 — 풀려나갈 때까지 새 시드 추가 안 함 (4) 위 어떤 단계에서도 기존 데이터는 그대로 노출됨 (archive graceful). **v5.1 context**: 1000/1500 임계는 *출시 후 성장 phase* 가드. V1 출시 시점 queue 규모(~100 Show 추정)에선 미발동. (Critic WEAK mitigation 흡수) |

---

## Verification Steps

**Phase 0**: `docs/phase0-search-spike.md` 채택 옵션 + pg_cron 가용성 명기. `pnpm prisma migrate status` clean. `pnpm build` 성공.

**Phase 1**: `docs/phase1-llm-eval.md` 120샘플 정확도 표 + CI + adversarial subset 결과 + 채택 모델. DB 통합 테스트: PoC 시나리오. **단위 테스트**: `computeShowFingerprint` (동일 입력→동일 hash, alias→같은 fingerprint, sort 안정성), `canonicalizeInstagramHandle` edge cases (해시태그/이메일/trailing dot), `seed-expand` depth=1 차단 (snowball→snowball skip), ≤5/배치, removed=true 건너뜀, consecutiveFails reset.

**Phase 2**: `docs/phase2-search-eval.md` 20-쿼리 ground-truth → AC-8 분기 정확도 ≥80%. Lighthouse Performance ≥80.

**Phase 3**: Playwright e2e — 401 미인증, 셋리스트 CRUD, **merge UX scenario** (artist 보정→dup→re-point + delete 검증), CrawlRun page 표시.

**Phase 4**: AC-19a (crawler off, pg_cron on) + AC-19b (both off) 양쪽 e2e 시나리오. AC-18 fixture로 40x 50% inject 모의 테스트. AC-12 p95 측정 → 800ms 게이트.

**PR 게이트**: Prisma migration 포함 PR은 `prisma migrate diff` 검토. ENV 변경 PR은 `.env.example` 동시 업데이트 (CI lint).

---

## ADR (Architecture Decision Record)

### Decision
국내 인디 공연·페스티벌 검색·아카이브 V1 MVP를 **단일 Vercel 프로젝트 + Supabase Postgres + (Phase 0 spike로 확정될) Korean FTS 엔진** 구성으로 구현한다. 크롤러는 Vercel Cron에서 시작하되 Fly.io 마이그레이션 트리거를 명시한다. LLM 정규화는 GPT-4o-mini와 Claude Haiku 3.5 head-to-head 평가 후 cost-per-correct-extraction 우위 모델을 채택한다. 데이터 모델은 canonicalKey 기반 안정적 dedup + merge UX로 admin 보정에 견디게 설계한다.

### Drivers (3, v4 재정렬)
1. **정보 커버리지 최대화** (Round 18 결정) — 운영 cap 폐기 후 1순위. Model A + 1필드 컷오프로 부분 정보도 노출
2. **IG 단일 소스 신뢰성 / archive-only fallback** — 외부 의존 단일 실패점에 대한 graceful degradation
3. **한국어 검색 정확도 + completeness 가중** — alias·한영 혼용 + 미완 카드 자연 후순위

### Alternatives Considered
- **Fly.io 단독 크롤러** — 인프라 컴포넌트 +1, 동등 운영비. 마이그레이션 트리거로 대체.
- **Cloudflare Workers 크롤러** — 30s CPU 제약으로 LLM 배치 부적합. 거부.
- **GitHub Actions Cron** — ephemeral IP가 IG 정중함에 불리. 거부.
- **Meilisearch 즉시 도입** — V1 규모에 over-spec. Phase 0 spike 결과 + AC-23 트리거로 조건부.
- **Magic-link admin auth** — 운영자 1인에게 외부 메일 서비스 도입은 over-engineered. 거부.
- **Auth.js/Clerk** — 엔드유저 인증 없는 V1에 미사용 라이브러리. 거부.
- **단순 fingerprint (canonicalize 없음)** — admin 보정 시 dup 발생 + venue alias 미처리. 거부.
- **`packages/search/` 추상화 없음** — 한 엔진에 commit하면 fallback 시 재작성 비용. 추상화 유지 (interface 1개 + impl 1개로 최소 surface).
- **운영자 게시물별 승인 (인터뷰 v1 선택)** — Contrarian round에서 운영 부담 폭주로 거부.

### Why Chosen
- All-in-Vercel + Supabase = **인프라 컴포넌트 2개**가 운영 ≤30분/주에 가장 부합. 매니지드 서비스 우선.
- Canonicalize 모듈은 dedup race + admin 보정 양쪽을 한 번에 해결. Surface +1 패키지지만 정확도 비대체 가능.
- Phase 0 spike + head-to-head LLM eval은 **검증 없는 commit을 회피**하면서도 1주 안에 결론이 나는 게이트.
- Fly.io / Meilisearch 마이그레이션 트리거는 **실패 시 명시적 runbook**으로 over-engineering을 piecewise로 ship.

### Consequences
- (+) MVP 8주 안에 ship 가능, 인프라 비용 ≤$25/월 (Supabase Pro 한도).
- (+) Archive-only fallback이 검증된 단일 실패점.
- (+) Dedup이 admin 보정·소스 다양화에 견딤.
- (−) `packages/search/`·`packages/canonicalize/` 추가 surface (Principle 3 압박, 정당화됨).
- (−) 검색 엔진 + LLM 모델이 Phase 0/1 spike 이전엔 미확정 (실행 초기 1주 유동성).
- (−) snowball depth=1이 일부 정당한 시드를 놓침 (인터뷰에서 운영자가 수용 가능 시그널).

### Follow-ups (V2 후보)
1. 페스티벌 베뉴 IG 자동 추적
2. 사용자 OAuth 로그인 + Personalization (즐겨찾기·알림)
3. 다중 데이터 소스 (멜론·인터파크·yes24·베뉴 홈페이지)
4. Setlist 부분 자동 추출 (YouTube 영상 설명 LLM 파싱)
5. canonicalKey 충돌 감지 + 운영자 alias merge UI
6. Meilisearch 마이그레이션 (검색 만족도 부족 트리거 시)
7. Fly.io 크롤러 마이그레이션 (5분 timeout cliff 트리거 시)
8. 다국어 (영문 검색·라벨)
9. **v5 추가**: `artistsExpected` + `artistsCompletenessRatio` 도입 — 페스티벌 라인업 partial extraction 정밀도 (AC-3b cardinality collapse 해소)
10. **v5 추가**: `AdminUser` 테이블 + audit log — 운영자 다인화 시 (운영 cap 폐기로 자원봉사자 분산 모델 가능)
11. **v5 추가**: snowball depth=2 — 커버리지 driver 하에서 PoC 데이터 후 검토. 현재 depth=1은 spam risk 방어 우선
12. **v5 추가**: AC-6b/AC-1 cap 재튜닝 — PoC 후 Vercel Cron 5분 안 LLM 처리 가능 수치 측정 기반

---

## Open Questions (남은 것)
- **pg_cron 가용성**: Supabase Pro 필요 여부 불확실. Phase 0 spike에서 확정.
- **`pgroonga` vs `pg_trgm` 최종 채택**: 동일 spike에서 결정.
- **120-sample eval의 adversarial subset 선정 기준**: Phase 1.7에서 protocol 문서화 필요.

---

## Changelog
- **v5.1 (현재)**: iter 4 verify pass 후 LOW polish 흡수 — AC-20 (8) rubric aggregation 명확화, `duplicateOfShowId` self-ref FK + index, ShowMergeLog retention append-only 명시, 보완 큐 임계 context 노트, Phase 2.7 buried-relevance KPI. **Architect+Critic 양쪽 APPROVED — 합의 완결.** Status: **PENDING APPROVAL (v5.1, ready for execution)**.
- **v5**: iter 3 양 리뷰어 NEEDS_REVISION 후 cascade fix — Principle/Driver 분리, Festival nullable + completeness, AC-5 dup-conflict 정책, ShowMergeLog 신설, AC-20 8-조건, AC-21 testable, AC-6c snowball gate, AC-7 tier-then-rank, AC-7b 배지 매핑, AC-16b 3-탭, cap 정당화, mitigation 3단, Follow-ups +4.
- **v4**: Round 18 사용자 결정 흡수 — 운영 cap 폐기, 3필드 컷오프 폐기 (Model A + 1필드), Show 부분 모델, completeness 가중 랭킹.
- **v3**: Architect APPROVED + Critic APPROVED-WITH-RESERVATIONS 후 잔여 개선 흡수 (Architect MAJOR-N7 + 5 MINORs, Critic 2 MAJORs + 6 minors). ADR 추가.
- **v2**: iteration 1 피드백 흡수 — 6 blocker + 7 major + 9 minor.
- **v1**: Planner initial draft.

---

## Final Status

**PENDING APPROVAL** — 합의 plan 확정. 실행 진입은 사용자의 별도 승인으로:
- `Skill("oh-my-claudecode:team")` (병렬 다중 agent, 권장 — 8주 plan에 큰 phase별 분할 적합)
- `Skill("oh-my-claudecode:ralph")` (순차 + Architect 검증, 1인 운영자 정신모델에 적합)
- `Skill("oh-my-claudecode:autopilot")` (전자율 phase 1부터)

별도 승인이 있을 때까지 어느 실행 스킬도 자동 invoke 하지 않음.
