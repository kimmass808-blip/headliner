# Handoff: Phase 0 → Phase 1 (TEMPLATE)

**Status:** TEMPLATE — Phase 0 완료 시점에 운영자/Phase 1 팀이 이 문서를 채운다.

---

## 채택 결정 사항 (Operator fills in)

### 검색 엔진 확정

Phase 0 spike 결과를 기반으로 선택:

- **채택 엔진**: [ ] pgroonga / [ ] pg_trgm + alias / [ ] Meilisearch

**근거**:
_(spike 결과, 정확도 평가, 성능 메모)_

```
예시:
- pgroonga: 성공 ✓ / 검색 정확도: '잔나비' O, '롤링' O, '페스' O / 형태소 분석: 만족
- pg_cron: 성공 ✓ / 15분 주기 refresh 가능
```

### pg_cron 가용성 확정

- [ ] pg_cron 가능 → 15분 주기 자동 refresh (Supabase cron.schedule)
- [ ] pg_cron 불가능 → Vercel Cron 끝에서 수동 호출 (REFRESH MATERIALIZED VIEW)

**Supabase Tier**: [ ] Free / [ ] Pro

**근거**:
_(Free tier에서 pgroonga/pg_cron 지원 여부)_

### MV Refresh 전략 확정

- [ ] **Automatic (pg_cron)**: `SELECT cron.schedule(..., '*/15 * * * *', ...)`
  - **Advantage**: 크롤러와 독립, 크롤러 실패가 search staleness 유발 안 함
  - **Implementation**: `packages/db/prisma/migrations/20260519100100_search_index/migration.sql`에 활성화

- [ ] **Manual (Vercel Cron)**: 크롤러 run 끝에서 `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - **Advantage**: DB 의존성 1개 (pg_cron 미필요)
  - **Implementation**: `packages/crawler/src/run.ts` 끝에 코드 추가

---

## 거부된 옵션 (Plan 재확인)

다음 옵션들은 plan v5.1에서 거부됨:

- Meilisearch (AC-23 트리거 시에만, 현재 미사용)
- Cloudflare Workers 크롤러
- GitHub Actions Cron
- Magic-link 인증
- Turborepo

_(spike 결과에서 새로운 거부 사유 발견 시 추가)_

---

## 알려진 리스크 및 완화책 (Phase 1 진입 시 상기)

| 리스크 | 트리거 | 완화책 |
|---|---|---|
| IG 공개 HTML 구조 변경 | selectors 매칭 < 80% | oEmbed fallback, archive graceful |
| IG 차단 (IP/bot) | HTTP 40x/429 ≥50% | 크롤러 일시정지, admin UI "재개" |
| LLM 정확도 부족 | 120-sample < 80% | prompt iterate, ensemble vote |
| 검색 만족도 부족 | AC-20 ground-truth < 80% | AC-23 Meilisearch 전환 |
| Vercel timeout | durationMs > 240s × 2 | AC-22 Fly.io 마이그레이션 |

---

## 산출물 (Phase 0 완성 확인)

Phase 0 후 다음 파일들 존재 확인:

**필수 (Blocking)**:
- [ ] `packages/db/prisma/schema.prisma` — v3 완전
- [ ] `packages/db/prisma/migrations/20260519100000_init/migration.sql` — DB 초기화
- [ ] `packages/db/prisma/migrations/20260519100100_search_index/migration.sql` — MV + 인덱스 (채택 엔진)
- [ ] `packages/canonicalize/src/index.ts` — 4개 함수 구현
- [ ] `packages/canonicalize/src/aliases.json` — 초기 50건 seed
- [ ] `packages/search/src/types.ts` — SearchEngine interface
- [ ] `packages/search/src/adapters/postgres.ts` (또는 meilisearch.ts) — 구현
- [ ] `docs/phase0-search-spike.md` — 작성·완료 (spike 결과 기록)
- [ ] `.env.example` — 모든 필요 ENV 나열

**선택 (Nice-to-have)**:
- [ ] `docs/runbooks/fly-migration.md` — AC-22 대비
- [ ] `docs/runbooks/meilisearch-migration.md` — AC-23 대비

---

## 다음 액션: Phase 1 Crawler 패키지 (Week 1-2)

### 1.1 패키지 스캐폴드

```bash
mkdir -p packages/crawler/src
mkdir -p packages/normalizer/src
```

### 1.2 IG Fetch 모듈

**파일**: `packages/crawler/src/ig-fetch.ts`

```typescript
export async function fetchInstagramPost(url: string): Promise<{
  text: string;
  imageUrls: string[];
  postedAt: Date;
}> {
  // (1) oEmbed 시도
  // (2) 실패 → HTML fetch + cheerio selector parsing
  // (3) 에러 logging + retry with backoff
}

export async function fetchInstagramAccount(
  igHandle: string,
  opts?: { limitPosts?: number; sinceCursor?: string }
): Promise<{ posts: any[]; nextCursor?: string }> {
  // 공개 HTML 또는 oEmbed로 계정의 최근 게시물 수집
}
```

**참고**: HTTP 200 시 `consecutiveFails = 0` reset. 4xx/5xx/timeout 시 증가.

### 1.3 LLM 분류기

**파일**: `packages/normalizer/src/classify.ts`

```typescript
export async function classifyPost(
  text: string,
  opts?: { model?: 'gpt-4o-mini' | 'claude-haiku' }
): Promise<{
  postType: 'single_show' | 'festival_lineup' | 'setlist' | 'unrelated';
  confidence: number;
}> {
  // Phase 1.7: head-to-head 평가 후 모델 결정
  // zod validation 강제
}
```

### 1.4 Extraction 모듈

**파일**: `packages/normalizer/src/extract-show.ts`, `extract-festival.ts`

```typescript
export async function extractShow(text: string): Promise<{
  date?: string;  // YYYY-MM-DD or null
  venue?: string;
  artists: string[];
  ticketUrl?: string;
}> {
  // LLM extraction + zod validation
}

export async function extractFestival(text: string): Promise<{
  name: string;
  startDate?: string;
  endDate?: string;
  locationText?: string;
  artists: string[];  // 라인업 또는 null
}> {
  // Festival은 model A (1필드 컷오프) — name만 있어도 가능
}
```

### 1.5 Fingerprint 모듈

**파일**: `packages/crawler/src/fingerprint.ts`

```typescript
import { createHash } from 'crypto';

export function computeShowFingerprint(input: {
  dateIso: string;  // YYYY-MM-DD
  venueCanonicalKey: string;
  artistCanonicalKeys: string[];  // pre-sorted
}): string {
  const sorted = [...input.artistCanonicalKeys].sort();
  const payload = `${input.dateIso}|${input.venueCanonicalKey}|${sorted.join(',')}`;
  return createHash('sha256').update(payload).digest('hex');
}
```

### 1.6 Seed Expand 모듈

**파일**: `packages/crawler/src/seed-expand.ts`

```typescript
export async function expandSeeds(
  festivalShow: any,  // extracted Festival + Shows
  prisma: PrismaClient
): Promise<void> {
  // (1) 게시물에서 @handle 파싱 (regex)
  // (2) canonicalizeInstagramHandle로 검증
  // (3) SeedAccount(status='pending', addedBy='snowball', sourceSeedHandle=<festival>) 추가
  // (4) ≤5/배치 cap 적용
  // (5) 기존 계정 건너뜀
}
```

### 1.7 Crawler Main Entry

**파일**: `packages/crawler/src/run.ts`

```typescript
export async function runCrawler() {
  // (1) SeedAccount(status IN ['active', 'pending']) 순회
  //     - active: ≤50 posts/account
  //     - pending: ≤5 posts/account (probation)
  // (2) 각 계정에서 lastFetched 이후 새 게시물만 fetch
  // (3) classify → extract → fingerprint → upsert
  // (4) seed-expand
  // (5) CrawlRun row update (status, stats)
  // (6) Discord webhook 알림 (optional)
  // (7) MV refresh (pg_cron 불가능 시 수동)
}
```

### 1.8 LLM 평가 (120-sample)

**파일**: `docs/phase1-llm-eval.md`

```
### Setup
- 실제 IG 계정 5-10개에서 120개 게시물 수집
- manual annotate: postType + extracted fields
- ≥12개는 adversarial (truncated, multilingual, emoji, noisy, ambiguous)

### Evaluation
- GPT-4o-mini vs Claude Haiku 3.5
- 동일 prompt 사용
- 정확도 계산: (correct extractions / 120) × 100%
- cost-per-correct: (API cost / correct extractions)
- 95% CI half-width 표기

### Decision
- cost-per-correct 우위 모델 채택
- 정확도 CI 겹침 + cost 차이 ≤10% → mini 기본 선택
```

---

## Phase 1 완료 Gate (진입 조건)

다음 모두 만족 시 Phase 2 진입:

- [ ] `packages/crawler/src/run.ts` 완성 + 단위 테스트 통과
- [ ] `packages/normalizer/` extraction 정확도 ≥80% (120-sample)
- [ ] PoC 시나리오: 페스티벌 IG 3개 → cron 수동 호출 → Show/Festival/SeedAccount 생성 확인
- [ ] `docs/phase1-llm-eval.md` 완성 (채택 모델 기록)
- [ ] fingerprint determinism 테스트 통과

---

## Risk Mitigation 재확인

### IG 차단 대응

```typescript
// AC-18: 24h rolling window에서 40x/429 ≥50% → status='blocked_suspected'
if (blockingRatio >= 0.5 && previousBlockInLast24h) {
  crawlRun.status = 'blocked_suspected';
  notifyDiscord('IG blocking suspected. Check IP/UA.');
  // 운영자가 admin에서 "재개" UI를 통해 재개 가능
}
```

### Snowball Spam 방지

```typescript
// AC-6b: ≤5 추가/배치
// AC-6c: operator-seeded 계정만, extracted Festival 있을 때만
const snowballCount = await expandSeeds(...);
if (snowballCount > 5) {
  // overflow next batch로 이월
}
```

---

## 환경 변수 확인 (Phase 1 시작 전)

`.env`에 다음 변수들이 있는지 확인:

```
# DB
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# LLM (Phase 1에서 필요)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Admin
ADMIN_PASSWORD=$2b$10$... (bcrypt hash)
ADMIN_JWT_SECRET=jwt-secret-here

# Crawl notifications (선택)
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/...
```

---

## 타임라인 (Phase 1)

**Week 1**:
- Day 1-2: IG Fetch + LLM Classify 모듈 (PoC)
- Day 3-4: Extraction (Show, Festival)
- Day 5: Fingerprint + Seed Expand + Crawler main

**Week 2**:
- Day 6-8: 120-sample LLM eval (GPT-mini vs Haiku)
- Day 9-10: PoC 시나리오 검증 (3개 페스티벌 IG → Run → 결과 확인)
- Day 10: Phase 1 완료 gate 검증 + Phase 2 진입

---

## 다음 단계: Phase 2 (Week 3-4)

Phase 1 완료 후 Phase 2 진입 조건 확인:

- **검색 MV**: Phase 0에서 생성 완료
- **검색 어댑터**: `packages/search/adapters/` 구현 완료
- **데이터**: Phase 1 crawler로 Show/Festival 100+ 건 확보

Phase 2 목표:
- `/api/search` 라우트 구현
- 공개 웹 (search page, show detail, festival detail)
- AC-8 context-aware 검색 분기
- AC-7 tier-then-rank (completeness 가중)

---

## 참고: 계획 링크

- **Master plan v5.1**: `.omc/plans/korean-indie-concert-discovery-plan.md`
- **Phase 0 handoff**: `.omc/handoffs/team-plan-to-phase0.md`
- **Spike 결과**: `docs/phase0-search-spike.md`
- **Migration runbooks**: `docs/runbooks/fly-migration.md`, `docs/runbooks/meilisearch-migration.md`

---

**Template version:** Phase 0→Phase 1 handoff v1
**To be filled by:** Operator at Phase 0 completion
**Target completion:** End of Week 2 (Phase 0 + Phase 1)
