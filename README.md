# MFT — 국내 인디 공연·페스티벌 검색·아카이브

전국 인디 씬 공연·페스티벌 정보를 인스타그램 자동 크롤링으로 수집·정규화하고, 익명 공개 검색 + 사이트 내 상세 페이지 + 운영자 admin(셋리스트·시드 관리·필드 보정) 을 제공하는 웹 플랫폼.

## 상태

**V1 MVP — Phase 0 진행 중 (Bootstrap + Spike 준비).**

전체 plan: [`.omc/plans/korean-indie-concert-discovery-plan.md`](.omc/plans/korean-indie-concert-discovery-plan.md) (v5.1 final, Architect+Critic 합의 통과)

전체 spec: [`.omc/specs/deep-interview-korean-indie-concert-discovery.md`](.omc/specs/deep-interview-korean-indie-concert-discovery.md) (17-라운드 deep-interview + Round 18)

## 핵심 결정 (요약)

- **데이터 소스**: 인스타그램 단일 (자동 크롤링, 운영자 승인 없음)
- **데이터 모델**: Model A — 1필드 컷오프, partial Show 허용 (completeness 0~3)
- **검색**: Postgres FTS (Phase 0 spike 후 pgroonga / pg_trgm / Meilisearch 중 채택)
- **정규화**: LLM 기반 (Phase 1 head-to-head 평가 후 GPT-4o-mini 또는 Haiku 3.5)
- **호스팅**: Vercel + Supabase 단일 인프라
- **archive-only fallback**: IG 차단 시 새 수집은 멈추고 웹은 기존 DB로 계속 작동

## 디렉토리 구조

```
mft/
├── apps/
│   └── web/                  # Next.js 15 (web + API + admin + crawler cron entrypoint)
├── packages/
│   ├── db/                   # Prisma schema + migrations + client
│   ├── canonicalize/         # venueText, artistName, igUrl, igHandle 정규화
│   ├── normalizer/           # LLM classify + extract (Phase 1)
│   ├── crawler/              # IG fetch + dedup + persist + seed-expand (Phase 1)
│   ├── search/               # Swappable search backend (Phase 2)
│   └── shared/               # zod 스키마, 공통 타입
├── docs/                     # spike 결과, eval 결과, runbook
├── .omc/                     # plan, spec, handoff (검토용)
└── pnpm-workspace.yaml
```

## 개발 시작

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 실제 값으로 채움

# Prisma 클라이언트 생성
pnpm db:generate

# DB 마이그레이션 (Supabase 프로젝트 준비 후)
pnpm db:migrate

# 개발 서버
pnpm dev
```

## Phase 0 사용자 액션 필요

다음은 코드 자동화 범위 밖이라 사용자가 직접 처리:

1. **Supabase 프로젝트 생성** — Free tier로 시작 가능
2. **`.env` 파일 채우기** — `.env.example` 참고
3. **Search spike 실행** — `docs/phase0-search-spike.md` 따라 pgroonga·pg_cron 가용성 확인 후 채택 엔진 기록
4. **`pnpm install` + `pnpm db:migrate` 실행** — Prisma migration을 Supabase에 적용

Spike 완료 후 Phase 1 (Crawler + Normalizer + LLM eval) 진입 가능.

## 라이선스

TBD
