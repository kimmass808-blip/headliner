# @mft/crawler

IG 자동 크롤링 + 정규화 적재 + 시드 확장.

**상태**: Phase 1에서 구현. 현재는 `computeShowFingerprint`만 제공 (스키마 정합성 검증용).

## 컴포넌트 (Phase 1)

- `ig-fetch.ts` — IG oEmbed 우선 시도 → fallback HTML + cheerio. 차단·에러 카운트만, 우회 evasion 없음.
- `dedup.ts` — Show upsert by `originalPostUrl @unique`. completeness=3 도달 시 fingerprint 계산 → unique conflict 시 `duplicateOfShowId` 마킹 + Discord 알림 (AC-5 v5).
- `seed-expand.ts` — 라인업 게시물의 `@handle` 파싱 → `SeedAccount(status='pending', addedBy='snowball', sourceSeedHandle=<festival>)`. AC-6b/c/d/e/f.
- `run.ts` — Vercel Cron entrypoint. 5분 timeout 내 1배치. CrawlRun row 시작/종료.

## AC 매핑

- AC-1: status='active'/'pending' 순회, post cap per account
- AC-5/5b: fingerprint + originalPostUrl 자연 키 + merge UX
- AC-6 시리즈: 시드 확장 + status 라이프사이클 + 안티 abuse
- AC-18: blocked_suspected 검출 + Discord 알림
- AC-19a/b: archive-only fallback (크롤러 정지해도 웹 정상)
- AC-22: 4분 초과 2회 → Fly.io 마이그레이션 트리거
