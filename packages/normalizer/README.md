# @mft/normalizer

IG 게시물 텍스트 → 구조화된 Show/Festival 추출.

**상태**: Phase 1에서 구현. 현재는 인터페이스/타입 스텁만.

## Phase 1 구현 계획

- `src/classify.ts` — LLM 분류기 (single_show / festival_lineup / setlist / unrelated)
- `src/extract-show.ts` — 단독공연 추출 (date, venue, artists, ticket, image)
- `src/extract-festival.ts` — 페스티벌 라인업 추출 (name, dates, sets, mentions)
- `src/prompts/` — system + user prompt 템플릿

## AC 매핑

- AC-2: 120-sample head-to-head 평가 (mini vs Haiku 3.5, ≥12 adversarial, 95% CI)
- AC-3: 단독공연 1필드 컷오프 (`completeness ≥ 1`)
- AC-4: 페스티벌 1필드 컷오프 (Festival.name 또는 startDate 중 1개)
- AC-3b: completeness/missingFields 계산은 `@mft/shared`의 `computeShowCompleteness` 사용
