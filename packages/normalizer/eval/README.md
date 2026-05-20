# AC-2 분류기 Head-to-Head 평가 방법론

## 개요

Phase 1.7에서 `openai-mini` (GPT-4o-mini) vs `anthropic-haiku` (claude-haiku-4-5) 분류기 정확도를
120개 수동 레이블 IG 게시물로 비교 평가한다.

## 데이터셋 구성 (120 샘플)

| 라벨 | 최소 샘플 수 | 비고 |
|---|---|---|
| `single_show` | 30 | 완전 추출 + partial 혼합 |
| `festival_lineup` | 30 | 대형~소규모 페스티벌 혼합 |
| `setlist` | 20 | 공연 후 셋리스트 게시물 |
| `unrelated` | 20 | 일상/광고/무관 게시물 |
| **adversarial** | ≥12 | 경계 케이스 (전체의 ≥10%) |

### Adversarial 샘플 기준

경계 케이스 예시:
- single_show vs festival_lineup: 2팀 합동 공연
- setlist vs single_show: 공연 예고 + 지난 셋리스트 동시 언급
- unrelated vs single_show: 공연 취소 공지
- 영어/영한 혼용 게시물
- 이모지 과다, 텍스트 최소 게시물

## 평가 지표

### 정확도 (Accuracy)
- 전체 정확도 ≥ 80% 합격 기준 (AC-2)
- 95% CI 반폭 (half-width) 계산: `z * sqrt(p*(1-p)/n)` (z=1.96)
- 합격 기준: 정확도 ≥ 0.80 AND CI 상한이 0.85를 넘지 않는 한 유효

### 라벨별 지표
- Per-label precision / recall / F1
- Confusion matrix

### 비용 효율 비교
- cost-per-correct-extraction (cents)
- 총 추론 비용 (120 샘플 기준)

## 실행 방법

```bash
# 데이터셋 파일 준비
cp eval/dataset.template.json eval/dataset.json
# ... 실제 레이블 작성 ...

# 양쪽 프로바이더로 평가 실행 (Phase 1.7에서 스크립트 추가 예정)
LLM_PROVIDER=openai-mini npx tsx eval/run.ts
LLM_PROVIDER=anthropic-haiku npx tsx eval/run.ts
```

## 결과 출력

평가 완료 후 `docs/phase1-llm-eval.md`에 결과 저장.

### 결과 템플릿

```markdown
# Phase 1 LLM 분류기 평가 결과

| 지표 | GPT-4o-mini | Claude Haiku 4-5 |
|---|---|---|
| 전체 정확도 | TBD | TBD |
| 95% CI 반폭 | TBD | TBD |
| cost/correct (cents) | TBD | TBD |
| 총 비용 (120샘플) | TBD | TBD |

## 최종 선택

AC-2 tie-break 정책: CI 겹침 시 GPT-4o-mini 기본 (Critic #3).
```

## 승인 기준 (AC-2)

- [ ] 양쪽 모델 정확도 계산 완료
- [ ] 95% CI 반폭 ≤ 0.09 (n=120 기준 최대 허용)
- [ ] adversarial 샘플 ≥ 12개 포함 확인
- [ ] `docs/phase1-llm-eval.md` 작성 완료
- [ ] 채택 모델 `ENV.LLM_PROVIDER` 기본값으로 설정
