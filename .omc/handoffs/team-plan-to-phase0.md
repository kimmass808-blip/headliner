# Handoff: team-plan → team-exec (Phase 0)

**Handoff date:** 2026-05-19
**Plan version:** v5.1 final (Architect+Critic APPROVED)
**Mode:** Direct execution after user approval

---

## 결정 사항 (Decided)

### 기술 스택 확정

- **호스팅 토폴로지**: All-in-Vercel (web + cron) + Supabase Postgres
  - Fly.io 마이그레이션 트리거: AC-22 (`CrawlRun.durationMs > 240s` × 2회 연속)
  - Meilisearch 전환 트리거: AC-23 (MV refresh > 120s OR search p95 > 800ms)

- **검색 엔진**: Phase 0 spike 후 확정
  - 후보 1: pgroonga (한국어 형태소 분석 최우)
  - 후보 2: pg_trgm + alias (fallback, substring match)
  - 후보 3: Meilisearch (AC-23 트리거 시 마이그레이션)

- **LLM 모델**: Phase 1 head-to-head 평가 후 확정
  - 후보: GPT-4o-mini vs Claude Haiku 3.5
  - 평가 기준: cost-per-correct-extraction (120-sample, ≥12개 adversarial)
  - 정확도 CI 겹침 + cost 차이 ≤10% 시 mini 기본 선택

- **ORM**: Prisma v5.1+
- **모노레포**: pnpm workspaces (Turborepo 미채택)
- **Admin 인증**: 단일 ENV `ADMIN_PASSWORD` (bcrypt hash) + jose JWT (7일 httpOnly)
- **MV refresh**: pg_cron 가용성 검증 후 → 가능하면 15분 주기 자동, 불가능하면 Vercel Cron 끝에서 수동

---

## 거부된 옵션 (Rejected)

| 옵션 | 거부 사유 |
|---|---|
| **Cloudflare Workers 크롤러** | 30s CPU 한도. LLM 배치 처리 부적합. |
| **GitHub Actions Cron** | ephemeral IP 풀이 IG 정중함에 불리. |
| **Auth.js / Clerk** | 엔드유저 인증 미필요. jose JWT 1 lib vs 4+ deps. |
| **Magic-link 어드민 인증** | 운영자 1인, 외부 메일 서비스 미필요. |
| **Turborepo** | pnpm workspaces로 충분. 빌드 캐시는 V2 대상. |
| **AdminUser 테이블** | 단일 ENV password 채택으로 미필요. |
| **Meilisearch 즉시 도입** | V1 규모에 over-spec. AC-23 트리거 조건부. |

---

## 알려진 리스크 (Risks)

| 리스크 | 트리거 (측정) | 완화책 |
|---|---|---|
| **pgroonga Supabase 미지원** | Phase 0 spike 1일 차 | fallback pg_trgm + alias 또는 Meilisearch |
| **pg_cron Free tier 미지원** | Phase 0 spike 첫 시도 | Vercel Cron 끝에서 수동 호출 또는 Pro tier 전환 |
| IG 공개 HTML 구조 변경 | selectors 매칭률 < 80% | oEmbed fallback + archive graceful 모드 |
| IG 차단 (IP/bot detection) | HTTP 40x/429 ≥50% rolling 24h | 크롤러 일시정지 + admin UI에서 재개 |
| LLM 추출 정확도 부족 | 120-sample 정확도 < 80% | prompt iterate + ensemble vote + 운영자 입력 비율 증가 |
| 한국어 검색 만족도 부족 | AC-20 ground-truth 정확도 < 80% | AC-23 Meilisearch 전환 runbook 발동 |
| Vercel Cron 5분 timeout | durationMs > 240s × 2회 | AC-22 Fly.io 마이그레이션 runbook 발동 |

---

## 산출물 (Files)

### 루트 스캐폴딩 (Phase 0)

- [ ] `package.json` — 루트 workspaces 정의
- [ ] `pnpm-workspace.yaml` — pnpm 설정
- [ ] `.env.example` — 환경 변수 템플릿
- [ ] `.gitignore` — Node, pnpm, Vercel, IDE 무시
- [ ] `tsconfig.base.json` — TypeScript 공유 설정
- [ ] `README.md` — 프로젝트 개요

### 데이터베이스 (Phase 0)

- [ ] `packages/db/package.json`
- [ ] `packages/db/prisma/schema.prisma` — v3 완전 정의
  - Artist, Venue, VenueAlias, Festival, Show, Setlist, Song, InstagramPost, SeedAccount, CrawlRun
  - ShowMergeLog (v5 신규)
  - duplicateOfShowId self-ref FK + index (v5.1)
  - completeness 필드 (Show, Festival)
  
- [ ] `packages/db/prisma/migrations/20260519100000_init/migration.sql` — 초기 스키마
- [ ] `packages/db/prisma/migrations/20260519100100_search_index/migration.sql`
  ```sql
  -- MV 정의 (pgroonga/pg_trgm/meilisearch 선택)
  CREATE MATERIALIZED VIEW search_index AS ...
  
  -- 엔진별 인덱스 (spike 결과에 따라 활성화)
  -- CREATE INDEX search_idx ON search_index USING pgroonga (body);
  -- CREATE INDEX search_idx ON search_index USING gin (body gin_trgm_ops);
  
  -- pg_cron refresh (가능성 검증 후)
  -- SELECT cron.schedule('refresh-search', '*/15 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY search_index$$);
  ```

### Canonicalization 모듈 (Phase 0)

- [ ] `packages/canonicalize/package.json`
- [ ] `packages/canonicalize/src/index.ts`
  - `canonicalizeVenueText(raw: string): { key: string; display: string }`
  - `canonicalizeArtistName(raw: string): { key: string; display: string }`
  - `canonicalizeInstagramUrl(url: string): string`
  - `canonicalizeInstagramHandle(raw: string): string | null`

- [ ] `packages/canonicalize/src/aliases.json` — 초기 50건 venue alias seed
  ```json
  [
    { "key": "rolling_hall", "aliases": ["롤링홀", "rolling hall"] },
    ...
  ]
  ```

- [ ] `packages/canonicalize/__tests__/index.test.ts`
  - `canonicalizeInstagramHandle` edge case (hashtag, email, trailing dot)
  - fingerprint determinism (같은 입력 → 같은 hash)
  - alias → 같은 canonical key 매핑

### 검색 모듈 (Phase 0 spike 결과 기반)

- [ ] `packages/search/package.json`
- [ ] `packages/search/src/types.ts`
  ```typescript
  export interface SearchEngine {
    search(query: string, opts?: SearchOptions): Promise<SearchResults>;
    index(doc: any): Promise<void>;
    bulkIndex(docs: any[]): Promise<void>;
  }
  ```

- [ ] `packages/search/src/adapters/postgres.ts` (현재, pgroonga 또는 pg_trgm 구현)
- [ ] `packages/search/src/adapters/meilisearch.ts` (AC-23 마이그레이션 시 활성화)

### 공유 라이브러리 (Phase 0)

- [ ] `packages/shared/src/types.ts` — Zod 스키마 (Show, Festival, Artist, CrawlRun)

### 문서 (Phase 0)

- [ ] `docs/phase0-search-spike.md` — spike methodology + operator checklist
- [ ] `docs/runbooks/fly-migration.md` — AC-22 트리거 시 runbook
- [ ] `docs/runbooks/meilisearch-migration.md` — AC-23 트리거 시 runbook
- [ ] `docs/ops-log.md` — operator timesheet (placeholder)

### Handoff 문서 (Phase 0)

- [ ] `.omc/handoffs/team-plan-to-phase0.md` — 현재 문서
- [ ] `.omc/handoffs/phase0-to-phase1.md` — template (Phase 0 완료 시 operator가 채움)

---

## 사용자 액션 필수 (Remaining)

Phase 0 시작 전 반드시 수행할 작업:

### 1. 의존성 설치

```bash
cd /path/to/mft
pnpm install
```

### 2. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 새 프로젝트 생성 (region: Asia-Pacific 권장)
3. 프로젝트 생성 완료 후 `.env` 파일 생성:

```bash
cp .env.example .env
# 아래 값들을 Supabase dashboard에서 복사:
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres"
```

### 3. Phase 0 검색 엔진 Spike 실행

`docs/phase0-search-spike.md` 단계 따라:

```bash
# Step 1-3: 확장 가용성 + 샘플 데이터 + 검색 정확도 검증
# (Supabase SQL Editor 또는 psql에서 수행)

# Step 4: 결정 트리 따라 최종 엔진 선택

# Step 5: pg_cron 가용성 평가

# 결과를 docs/phase0-search-spike.md에 기록
```

**소요 시간:** ~2-3시간

### 4. 채택 엔진 활성화

spike 결과에 따라:

```bash
# packages/db/prisma/migrations/20260519100100_search_index/migration.sql 수정
# 채택된 엔진 인덱스만 활성화

pnpm db:migrate
```

### 5. 검색 어댑터 구현 (Phase 0 후반)

spike 결과에 따라 `packages/search/adapters/` 초기 구현

- pgroonga 채택 → `postgres-pgroonga.ts`
- pg_trgm 채택 → `postgres-trgm.ts` + alias lookup
- Meilisearch → Phase 1 defer

### 6. 초기 시드 데이터 준비 (선택)

Phase 1 crawler 테스트용 페스티벌 IG 계정 3-5개 수집

---

## Phase 1 진입 조건 (Gate)

Phase 0 완료 후 **모두 만족** 시 Phase 1 시작:

- [ ] `docs/phase0-search-spike.md` 완성 + 채택 엔진 기록
- [ ] `packages/db/prisma/migrations/` clean (pending 없음)
- [ ] `pnpm build` 성공 (모든 packages compile)
- [ ] `.omc/handoffs/phase0-to-phase1.md` template 작성 완료 (Phase 1 시작 시 채울 내용)

---

## Phase 1 시작 시 해야 할 첫 작업

`.omc/handoffs/phase0-to-phase1.md` 참고:

1. **Crawler + Normalizer 패키지 스캐폴드**
   - `packages/crawler/` — IG fetch, dedup, fingerprint, seed-expand, run orchestration
   - `packages/normalizer/` — LLM classify, extract-show, extract-festival

2. **IG oEmbed vs HTML fetch PoC**
   - oEmbed API 우선 (공개, rate limit 고려)
   - fallback HTML + cheerio selector parsing

3. **LLM 분류기 prompt v1**
   - 'single_show' / 'festival_lineup' / 'setlist' / 'unrelated' 4-way classification
   - zod validation layer

4. **120-sample annotation 데이터셋 준비**
   - 실제 IG 페스티벌 계정 5-10개에서 120개 게시물 수집
   - manual label: postType + extracted Show/Festival fields

---

## 타임라인

**Phase 0: 3-5일 (Day 0-5)**
- Day 0-1: 루트 스캐폴딩 + DB 초기화
- Day 1-2: 검색 엔진 spike
- Day 2-3: 스피크 결과에 따라 어댑터 초기 구현
- Day 3-5: 문서화 + 검증

**Phase 1: 8-10일 (Week 1-2)**
- Crawler 구현
- Normalizer 구현
- 120-sample LLM eval
- PoC 시나리오 검증

**Phase 2: 9-12일 (Week 3-4)**
- 공개 검색 웹
- SEO + sitemap
- ground-truth 검색 평가

**Phase 3: 5-7일 (Week 5-6)**
- Admin UI (login, seeds, shows, setlists, merge UX)

**Phase 4: 5-7일 (Week 7-8)**
- 회복성 (Discord 알림, blocked_suspected 감지)
- 마이그레이션 runbooks
- 출시 시드 (AC-20 8-조건 검증)

**총 8주 예상**

---

## 커뮤니케이션

- **Spike 진행 중**: 이슈/차단점 발생 시 `#mft` Slack 실시간 보고
- **Phase 0 완료**: `.omc/handoffs/phase0-to-phase1.md` 최종 작성 + team session 시작 신청
- **Weekly**: 매 주 월요일 진행 상황 summary

---

## 참고: 계획 문서 위치

- **Master plan**: `.omc/plans/korean-indie-concert-discovery-plan.md` (v5.1 final)
- **Spike methodology**: `docs/phase0-search-spike.md` (operator fill-in)
- **Migration runbooks**: `docs/runbooks/fly-migration.md`, `docs/runbooks/meilisearch-migration.md`

---

**Handoff prepared by:** Writer agent (Phase 0 documentation)
**Date:** 2026-05-19
**Ready for execution:** Awaiting user approval
