# Phase 0 Search Spike: 한국어 검색 엔진 선택

## 목적

AC-0을 만족시키기 위해 Supabase Postgres 환경에서 한국어 검색 엔진 후보를 검증한다.

**후보 엔진:**
1. pgroonga — PostgreSQL 네이티브 전문검색 확장. 일본어·중국어·한국어 형태소 분석 지원.
2. pg_trgm + alias — PostgreSQL 트리그램 기반 유사도 검색. fallback 옵션.
3. Meilisearch — 외부 독립 서버. 형태소 분석 완벽하나 인프라 추가 필요.

**동시 검증:**
- `pg_cron` 가용성 (MV refresh 스케줄링 용)

---

## 선행 조건

- Supabase 프로젝트 생성 완료
- `.env`에 `DATABASE_URL`와 `DIRECT_URL` 채워짐
- psql 또는 Supabase Dashboard SQL Editor 접근 가능
- 테스트용 mock 데이터 10건 정도 준비 가능

---

## 단계 1: 확장 가용성 확인

Supabase SQL Editor 또는 psql에서 다음 명령어를 실행하고 결과를 기록한다.

### pgroonga 확장

```sql
CREATE EXTENSION IF NOT EXISTS pgroonga;
```

**결과 기록:**
- [ ] 성공
- [ ] 실패 — 에러 메시지:

**참고:** Supabase Free tier에서는 지원 불가 가능성 높음. Pro tier 필요할 수 있음.

### pg_cron 확장

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**결과 기록:**
- [ ] 성공
- [ ] 실패 — 에러 메시지:

**참고:** Supabase에서 pg_cron 지원 상태 확인 필수. Extension list에 없으면 불가.

### pg_trgm 확장

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**결과 기록:**
- [ ] 성공 (Supabase 기본 포함 예상)
- [ ] 실패 — 에러 메시지:

---

## 단계 2: 샘플 검색 데이터 적재

한국어 mock 데이터 10건(artist·venue 혼합)을 다음과 같이 적재한다.

```sql
-- 임시 테이블 생성 (spike 전용)
CREATE TEMP TABLE search_test (
  id SERIAL PRIMARY KEY,
  kind TEXT,
  text TEXT
);

-- 샘플 데이터 삽입
INSERT INTO search_test (kind, text) VALUES
  ('artist', '잔나비'),
  ('artist', '하이라이트'),
  ('artist', '씬디'),
  ('venue', '롤링홀'),
  ('venue', '세로운씨어터'),
  ('festival', '서울라이브페스'),
  ('festival', '부산뮤직위크'),
  ('artist', '스탠딩에그'),
  ('venue', '그레이트풀데드'),
  ('festival', '인디포크페스');
```

**결과 기록:** 삽입 완료 여부 및 행 개수 확인.

---

## 단계 3: 각 엔진 검색 정확도 sanity check

### pgroonga 검색 (pgroonga 성공한 경우만)

```sql
-- 인덱스 생성
CREATE INDEX search_test_pgroonga_idx ON search_test USING pgroonga (text);

-- 검색 쿼리
SELECT id, kind, text FROM search_test WHERE text &@~ '잔나비';
SELECT id, kind, text FROM search_test WHERE text &@~ '롤링';
SELECT id, kind, text FROM search_test WHERE text &@~ '페스';
```

**결과 기록:**
- 쿼리 '잔나비' 결과: (행 나열 또는 0 rows)
- 쿼리 '롤링' 결과: (행 나열 또는 0 rows)
- 쿼리 '페스' 결과: (행 나열 또는 0 rows)
- **만족도:** (형태소 분석 후 정확한 결과 반환 여부 평가)

### pg_trgm 검색 (pg_trgm 성공한 경우)

```sql
-- 인덱스 생성
CREATE INDEX search_test_trgm_idx ON search_test USING gin (text gin_trgm_ops);

-- 검색 쿼리 (유사도 기반)
SELECT id, kind, text, similarity(text, '잔나비') AS score 
FROM search_test 
WHERE text % '잔나비'
ORDER BY score DESC;

SELECT id, kind, text, similarity(text, '롤링') AS score
FROM search_test
WHERE text % '롤링'
ORDER BY score DESC;

SELECT id, kind, text, similarity(text, '페스') AS score
FROM search_test
WHERE text % '페스'
ORDER BY score DESC;
```

**결과 기록:**
- 쿼리 '잔나비' 결과: (행 나열 + similarity score)
- 쿼리 '롤링' 결과: (행 나열 + similarity score)
- 쿼리 '페스' 결과: (행 나열 + similarity score)
- **만족도:** (partial/substring match 수준 평가)

### Meilisearch 검증 (선택, 로컬 docker 또는 cloud 인스턴스)

Meilisearch 인스턴스가 준비되어 있으면:

```bash
# Meilisearch에 데이터 색인 (예시, language를 korean으로 설정)
curl -X POST 'http://localhost:7700/indexes/search_test/documents' \
  -H 'Content-Type: application/json' \
  -d '[
    {"id":1, "kind":"artist", "text":"잔나비"},
    {"id":2, "kind":"artist", "text":"하이라이트"},
    ... (나머지 데이터)
  ]'

# 검색 쿼리
curl 'http://localhost:7700/indexes/search_test/search?q=잔나비'
curl 'http://localhost:7700/indexes/search_test/search?q=롤링'
curl 'http://localhost:7700/indexes/search_test/search?q=페스'
```

**결과 기록:**
- 각 쿼리별 반환 결과 개수
- **만족도:** (한국어 형태소 분석 품질 평가)

---

## 단계 4: 결정 트리

아래 flowchart를 따라 최종 엔진을 선택한다.

```
pgroonga 생성 성공?
├─ YES → 검색 정확도 만족?
│        ├─ YES → **[결정: pgroonga 채택]**
│        └─ NO → (다음으로)
├─ NO → (다음으로)
└─ pg_trgm 생성 성공?
   ├─ YES → 형태소 분석(예: '롤링'→'rolling'로 매칭) 만족?
   │        ├─ YES → **[결정: pg_trgm + alias 채택]**
   │        └─ NO → (다음으로)
   └─ NO → (다음으로)

최종 선택지 없음?
└─ **[결정: Meilisearch 마이그레이션 트리거 (AC-23)]**
   ├─ Phase 1 시작 후 별도 runbook 진입
   └─ 인스턴스 프로비저닝 + 동기화 전략 수립
```

---

## 단계 5: pg_cron MV refresh 가능성 평가

pg_cron이 생성 성공했으면, 15분 주기 MV refresh 가능성을 평가한다.

```sql
-- pg_cron 스케줄 등록 테스트 (dummy MV 사용)
SELECT cron.schedule(
  'test-refresh',
  '*/15 * * * *',
  'SELECT 1'  -- no-op
);

-- 등록 확인
SELECT * FROM cron.job WHERE jobname = 'test-refresh';
```

**결과 기록:**
- [ ] pg_cron 스케줄링 가능
- [ ] pg_cron 불가능 → Vercel Cron 끝에서 MV refresh 호출로 변경

---

## 출력 템플릿

아래 섹션을 채워 최종 결과를 문서화한다.

## Spike 결과 ([날짜 YYYY-MM-DD 기입])

### Extension 가용성

- **pgroonga**: [ ] 성공 / [ ] 실패 — 메모:
- **pg_cron**: [ ] 성공 / [ ] 실패 — 메모:
- **pg_trgm**: [ ] 성공 / [ ] 실패 — 메모:

### 검색 정확도 평가

| 엔진 | '잔나비' | '롤링' | '페스' | 형태소 분석 | 종합 평가 |
|---|---|---|---|---|---|
| pgroonga | _(행 수)_ | _(행 수)_ | _(행 수)_ | [ ] 만족 / [ ] 부족 | _(메모)_ |
| pg_trgm | _(행 수)_ | _(행 수)_ | _(행 수)_ | [ ] 만족 / [ ] 부족 | _(메모)_ |
| Meilisearch | _(행 수)_ | _(행 수)_ | _(행 수)_ | [ ] 만족 / [ ] 부족 | _(메모)_ |

### 채택 엔진

- [ ] pgroonga
- [ ] pg_trgm + alias
- [ ] Meilisearch (별도 인스턴스)

### 채택 사유

_(엔진 선택 근거 — 정확도·성능·운영 복잡도 언급)_

### MV Refresh 전략

- [ ] pg_cron으로 15분 주기 자동 갱신
- [ ] Vercel Cron 끝에서 수동 호출 (`REFRESH MATERIALIZED VIEW CONCURRENTLY`)

_(선택한 이유)_

### 다음 액션

- [ ] `packages/db/prisma/migrations/20260519100100_search_index/migration.sql`에서 채택 엔진의 인덱스 라인만 활성화. 미채택 라인은 주석 처리.
- [ ] `packages/search/` 어댑터 구현 시작 — 채택 엔진 타입 정의 (SearchEngine interface 사용)
- [ ] pg_cron 가용성 결과 → `packages/db/prisma/schema.prisma`의 cron.schedule 주석 활성화 또는 Vercel cron route 준비
- [ ] 검색 쿼리 테스트 — 실제 MV + 인덱스에 대해 3-5개 쿼리 수행하여 응답 시간 측정 (AC-12 p95 기준선 수립)

---

## 참고: 다음 단계로의 연결

Spike 완료 후:
1. Phase 0 다른 deliverable 작성 (`fly-migration.md`, `meilisearch-migration.md` 등)
2. `.omc/handoffs/team-plan-to-phase0.md` 작성 — 승인된 기술 스택 기록
3. Phase 1 진입 — Crawler + Normalizer 구현 시작

---

**Document version:** Phase 0 spike template v1
**Last updated:** 2026-05-19
