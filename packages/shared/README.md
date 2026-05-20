# @mft/shared

공통 타입·zod 스키마·라벨 매핑.

## 모듈

- `post-classification` — IG 게시물 유형 분류 LLM 출력 스키마 (AC-2)
- `show-extraction` — 단독공연 추출 LLM 출력 스키마 + completeness 계산 (AC-3, AC-3b)
- `festival-extraction` — 페스티벌 라인업 추출 LLM 출력 스키마 (AC-4)
- `missing-field-labels` — 미완 Show 배지 텍스트 한글 매핑 (AC-7b)
- `completeness` — 검색 랭킹용 가중치·tier 함수 (AC-7)

## 사용 예

```ts
import { ShowExtractionSchema, computeShowCompleteness } from '@mft/shared';

const raw = await llm(prompt);
const extraction = ShowExtractionSchema.parse(JSON.parse(raw));
const { completeness, missingFields } = computeShowCompleteness(extraction);
// → DB에 저장 시 Show.completeness, Show.missingFields, Show.needsReview 채움
```
