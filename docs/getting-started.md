# Getting Started — 코드부터 첫 가동까지

이 문서는 `pnpm install` → Supabase 세팅 → spike → 마이그레이션 → 첫 검색까지의 실행 가이드입니다. 순서대로 따라가면 됩니다.

**예상 소요 시간**: 처음이면 1.5–2 시간 (Supabase 가입·신용카드 등록 등 외부 작업 포함).

---

## 사전 준비물

| 항목 | 확인 명령 | 없으면 |
|---|---|---|
| Node.js ≥20 | `node -v` | https://nodejs.org/ 또는 `brew install node@20` |
| pnpm ≥9 | `pnpm -v` | `npm install -g pnpm` |
| psql (선택) | `psql --version` | `brew install libpq && brew link --force libpq` — Supabase Dashboard SQL Editor만 써도 됨 |
| Supabase 계정 | https://supabase.com | 가입 (무료, 카드 등록 필요 없음) |
| OpenAI API 키 | https://platform.openai.com/api-keys | Phase 1 LLM 평가 직전까지는 없어도 OK |

---

## Step 1 — 의존성 설치

```bash
cd /Users/k5d/Desktop/claude/mft
pnpm install
```

**예상 출력**:
```
Lockfile is up to date, resolution step is skipped
Progress: resolved 850, reused 0, downloaded 850, added 850
devDependencies:
+ prettier 3.3.x
+ typescript 5.6.x
...
Done in 45s
```

**실패 시**:
- `ERR_PNPM_PEER_DEP_ISSUES` → `pnpm install --strict-peer-dependencies=false`
- 특정 패키지 빌드 실패 (e.g., `bcryptjs`) → Node 버전 확인. Node 22 권장.

**검증 (즉시)**:
```bash
pnpm typecheck 2>&1 | head -50
```
첫 실행에서 import 에러가 몇 개 나올 수 있어요. 거의 다 `.js` 확장자 누락 또는 미세한 타입 차이입니다. 다음 step과 무관하게 백그라운드로 잡으면 됩니다.

**캐노니컬라이즈 단위 테스트 실행** (DB 없이 확인 가능):
```bash
pnpm --filter @mft/canonicalize test
```
30개 테스트 통과해야 정상. 실패하면 alias JSON 또는 정규식 issue.

---

## Step 2 — Supabase 프로젝트 만들기

1. https://app.supabase.com/projects 접속 → **New project**
2. Organization 선택 (기본값 OK), Project name = `mft` (또는 원하는 이름)
3. **Database password**: 강력한 비밀번호 생성 후 **비밀번호 관리자에 저장** (이후 못 봄)
4. Region: `Northeast Asia (Seoul)` 권장
5. Plan: **Free** 로 시작 — 추후 디스크/connection 부족 시 Pro($25/월) 전환
6. **Create new project** 클릭 → 1–2분 대기

생성 완료 후 **Project Settings → Database** 페이지에서 두 가지 connection string 확인:

- **Connection string (Transaction mode)** — 일반 쿼리용, Vercel serverless에 사용
  ```
  postgresql://postgres.[REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
  ```
- **Connection string (Session mode / Direct)** — Prisma migration용
  ```
  postgresql://postgres.[REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
  ```

둘 다 복사해 두세요.

---

## Step 3 — `.env` 파일 생성

```bash
cp .env.example .env
```

이제 `.env` 를 열어 다음 항목들을 채웁니다:

### 3-1. DB URL (Step 2에서 복사한 값)
```env
DATABASE_URL="postgresql://postgres.xxxxx:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxxxx:YOUR-PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
```

### 3-2. Admin 비밀번호 hash 생성

운영자 본인이 쓸 admin 비밀번호를 정합니다 (16자 이상 권장). 그다음:

```bash
node -e "console.log(require('bcryptjs').hashSync('당신의비밀번호', 10))"
```

출력된 `$2a$10$...` 전체를 `.env`의 `ADMIN_PASSWORD_HASH`에 붙여넣기.

### 3-3. JWT secret 생성

```bash
openssl rand -base64 32
```

출력값을 `ADMIN_JWT_SECRET`에 붙여넣기.

### 3-4. LLM 키 (Phase 1까지는 비워둬도 OK)
```env
OPENAI_API_KEY="sk-..."         # 비워두면 LLM 호출 시 에러 (당장 가동엔 OK)
ANTHROPIC_API_KEY=""             # 선택 (head-to-head 평가 시 필요)
```

### 3-5. Discord webhook (선택)
운영자 본인의 Discord 서버에 webhook 만들고 URL 붙여넣기. 비워두면 알림 silent no-op (개발엔 OK).

### 3-6. 기타
```env
IG_FETCH_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
SEARCH_ENGINE="pg_trgm"          # Step 4 spike 후 'pgroonga'로 바꿀 수도
```

**저장한 다음**: `.env` 파일이 `.gitignore`에 있는지 한 번 더 확인 (이미 있음).

---

## Step 4 — Phase 0 Spike (검색 엔진 결정)

이 단계가 **검색 엔진을 결정**합니다. 자세한 방법은 [`docs/phase0-search-spike.md`](./phase0-search-spike.md). 핵심만 요약:

### 4-1. Supabase Dashboard → SQL Editor 열기

### 4-2. pgroonga 시도 (한국어 형태소 처리 최선)

```sql
CREATE EXTENSION IF NOT EXISTS pgroonga;
```

**결과 기록**:
- ✅ 성공 → SEARCH_ENGINE=pgroonga (1순위 채택)
- ❌ `extension "pgroonga" is not available` → pg_trgm fallback (대부분의 Supabase Free에서 이 케이스)

### 4-3. pg_cron 시도 (MV refresh 분리)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

- ✅ 성공 → pg_cron으로 15분마다 자동 MV refresh
- ❌ 실패 → MV refresh를 Vercel Cron 끝에서 수동 호출 (코드 한 줄 추가만 필요)

### 4-4. pg_trgm 확인 (기본 포함 예상)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

거의 무조건 성공.

### 4-5. 결과를 `docs/phase0-search-spike.md` 끝부분 "Spike 결과" 섹션에 체크리스트로 기록.

### 4-6. 채택한 엔진에 따라 migration 인덱스 활성화

`packages/db/prisma/migrations/20260519100100_search_index/migration.sql` 열어서:

- **pgroonga 채택**: 아래 라인의 주석 제거
  ```sql
  CREATE INDEX search_idx ON search_index USING pgroonga (body);
  ```
- **pg_trgm 채택**: 아래 라인의 주석 제거
  ```sql
  CREATE INDEX search_idx ON search_index USING gin (body gin_trgm_ops);
  ```

그리고 `.env`의 `SEARCH_ENGINE` 값도 일치시킴.

---

## Step 5 — Prisma 마이그레이션 적용

```bash
pnpm db:generate          # Prisma Client 생성
pnpm db:migrate           # Supabase에 스키마 + MV 적용
```

**예상 출력**:
```
Applying migration `20260519100000_init`
Applying migration `20260519100100_search_index`
The following migration(s) have been applied:

migrations/
  └─ 20260519100000_init/
     └─ migration.sql
  └─ 20260519100100_search_index/
     └─ migration.sql

✔ Generated Prisma Client (5.22.x) to ./node_modules/@prisma/client
```

**실패 시**:
- `P1001: Can't reach database server` → DATABASE_URL/DIRECT_URL 다시 확인 (특히 비밀번호 escape 필요한 특수문자 있는지)
- `relation "_ShowArtists" already exists` → 기존 스키마와 충돌. 빈 DB여야 함.
- `extension "pgroonga" does not exist` → Step 4-6 한 단계 빼먹음. migration.sql에서 pgroonga 라인 주석 처리, pg_trgm 라인 활성화.

**검증**:
Supabase Dashboard → **Table Editor**에서 다음 11 테이블 보여야 정상:
`Artist, Venue, VenueAlias, Festival, Show, Setlist, Song, InstagramPost, SeedAccount, CrawlRun, ShowMergeLog, _ShowArtists`

---

## Step 6 — 개발 서버 첫 가동

```bash
pnpm dev
```

**예상 출력**:
```
> @mft/web@0.0.0 dev /Users/k5d/Desktop/claude/mft/apps/web
> next dev

   ▲ Next.js 15.0.x
   - Local:        http://localhost:3000
   - Environments: .env

 ✓ Starting...
 ✓ Ready in 2.3s
```

브라우저에서 http://localhost:3000 → **검색 메인 페이지** 보여야 정상.

검색창에 아무거나 입력 → 빈 결과 ("검색 결과가 없습니다.") — 정상. 아직 데이터 없음.

**`/admin/login` 접속** → 비밀번호 입력 (Step 3-2에서 정한 값) → admin 대시보드.

대시보드에 모두 0:
- 보완 큐 0
- 중복 후보 0
- 시드 0
- 최근 크롤 실행 없음

여기까지 오면 **인프라 가동 성공**.

---

## Step 7 — 첫 시드 IG 계정 추가

Admin → **시드 관리** (`/admin/seeds`)

"새 시드 추가" 폼에서:
- handle: 페스티벌 IG 계정 (예: `grandmint_festival`)
- kind: `festival`
- → **추가** 클릭

5–10개 페스티벌 IG 입력 추천 (snowball로 아티스트 계정이 자동 확장됨).

예시:
- `grandmint_festival`
- `pentaport_rock_festival`
- `jisan_valley_rock_festival`
- `seoul_jazz_festival`
- `coachella_korea_official` (가상)
- 등 본인이 관심 있는 페스티벌 핸들

---

## Step 8 — 첫 크롤 수동 실행

**중요**: 실제 IG fetch는 변동 심하므로 첫 가동에서 **실패할 수 있음**. 그때는 7-2로 점프.

### 8-1. CRON_SECRET 설정 (수동 호출용)

`.env`에 추가:
```env
CRON_SECRET="아무 랜덤 문자열 (openssl rand -base64 24)"
```

### 8-2. 호출

새 터미널에서:
```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2 | tr -d '\"')" \
     http://localhost:3000/api/cron/crawl
```

**성공 시 응답**:
```json
{
  "ok": true,
  "crawlRunId": "clxxxx",
  "durationMs": 12345,
  "summary": { "accountsAttempted": 5, "showsCreated": 12, ... }
}
```

**실패 시 응답** (예상되는 케이스):
```json
{
  "ok": false,
  "error": "ig-fetch failed: HTTP 401 ..."
}
```

이건 IG가 비공개 API 차단했다는 신호 — V1 archive-only fallback의 핵심 시나리오입니다. 그래도 웹사이트는 정상 작동해야 합니다 (Step 6의 검색 메인이 200 응답).

Admin → **CrawlRun 로그**에서 실패 상세 확인 가능.

---

## 7-2. (Fallback) Mock 데이터로 검증

크롤러가 실패해도 시스템 검증을 위해 직접 DB에 한두 건 넣어볼 수 있습니다.

Supabase Dashboard → SQL Editor:

```sql
-- 가상 Artist
INSERT INTO "Artist" (id, "canonicalName", "canonicalKey", aliases, "firstSeenAt", "id")
VALUES ('test-artist-1', '잔나비', '잔나비', ARRAY['JANNABI'], NOW());

-- 가상 Venue
INSERT INTO "Venue" (id, name, "canonicalKey", address, region)
VALUES ('test-venue-1', '롤링홀', 'rolling_hall', '서울 마포구 와우산로', '서울');

-- 가상 Show (완성 = completeness 3)
INSERT INTO "Show" (
  id, date, "venueId", "originalPostUrl", completeness, "missingFields", "needsReview",
  fingerprint, "fingerprintInputs", "createdAt", "updatedAt"
)
VALUES (
  'test-show-1',
  '2026-06-15',
  'test-venue-1',
  'https://www.instagram.com/p/test123/',
  3,
  ARRAY[]::text[],
  false,
  'fake-fingerprint-1',
  '{"dateKey":"2026-06-15","venueCanonicalKey":"rolling_hall","artistCanonicalKeys":["잔나비"]}'::jsonb,
  NOW(),
  NOW()
);

INSERT INTO "_ShowArtists" ("A", "B") VALUES ('test-show-1', 'test-artist-1');

-- search_index 새로고침
REFRESH MATERIALIZED VIEW search_index;
```

그다음 http://localhost:3000 에서 "잔나비" 검색 → 결과 1개 나와야 정상.

---

## Step 9 — 다음에 할 것

여기까지 오면 V1 인프라 시동 완료. 이후 단계:

1. **IG fetch viability 검증** — Step 8이 실패했다면 `packages/crawler/src/ig-fetch.ts`의 fetch 전략 조정 필요. 별도 PoC 세션.
2. **LLM API 키 채우기** — OPENAI_API_KEY 추가 후 Phase 1.7 LLM 평가 (`packages/normalizer/eval/` 참조).
3. **시드 부트스트랩** — 5-10 페스티벌 시드 → 3-7일 cron 자동 실행 관찰.
4. **AC-20 출시 게이트** — Show ≥100, 완성 ≥30, future-dated ≥15, correctness ≥90% 측정.
5. **Vercel 배포** — `vercel deploy` (Vercel CLI 설치 필요). vercel.json의 cron schedule이 자동 적용.

---

## 막혔을 때

가장 흔한 막힘 지점과 대처:

| 막힘 | 대처 |
|---|---|
| `pnpm install` 중 빌드 에러 | Node 22로 업그레이드 (`brew install node@22`) |
| Supabase connection refused | Project 상태가 "Active"인지 확인 (생성 후 2분 정도 걸림) |
| `prisma migrate` permission 에러 | DIRECT_URL이 Session mode (포트 5432)인지 확인 |
| 검색해도 빈 결과 | DB에 데이터 없음 (정상). Step 7 또는 7-2 진행 |
| 검색 결과 있는데 한국어 검색 안 됨 | SEARCH_ENGINE 값과 migration 인덱스 일치 확인 |
| IG fetch 401/403 | 정상 — archive-only fallback. mock 데이터로 검증 OR fetch 전략 조정 |
| admin 로그인 안 됨 | ADMIN_PASSWORD_HASH가 bcrypt hash인지 확인 (`$2a$10$...` 형식) |

---

## 도움 더 필요할 때

- 전체 plan: [`.omc/plans/korean-indie-concert-discovery-plan.md`](../.omc/plans/korean-indie-concert-discovery-plan.md) v5.1
- 인터뷰 결정 트레일: [`.omc/specs/deep-interview-korean-indie-concert-discovery.md`](../.omc/specs/deep-interview-korean-indie-concert-discovery.md)
- 다음 단계 handoff 템플릿: [`.omc/handoffs/phase0-to-phase1.md`](../.omc/handoffs/phase0-to-phase1.md)
