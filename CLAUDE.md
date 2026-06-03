# ⛔ DB 안전 규칙 (최우선 — 위반 시 데이터 전체 손실)

**`.env`의 `DATABASE_URL`·`DIRECT_URL`은 프로덕션 Supabase를 가리킨다. 별도 dev DB가 없으므로 모든 DB 명령은 곧장 프로덕션에 적용된다.**

## 절대 실행 금지 (프로덕션 대상)
다음은 스키마/데이터를 drop·reset하므로 **프로덕션 연결로 절대 실행하지 말 것**:
- `prisma migrate reset`
- `prisma migrate dev` (드리프트 감지 시 reset 유도)
- `prisma db push --force-reset` / `--accept-data-loss`
- `prisma migrate diff --from-migrations … --shadow-database-url <DIRECT_URL/DATABASE_URL>`
  → **shadow DB는 Prisma가 매번 리셋한다. 여기에 프로덕션 URL을 넣으면 전체 DB가 초기화된다.**
  (2026-06-01 실제로 이 명령으로 프로덕션 전체 데이터가 삭제됨 — 재적재로 복구.)
- `--shadow-database-url` 또는 `--url`에 프로덕션 connection을 넣는 모든 명령

## 안전한 대안
- **컬럼 추가 등 가산적(additive) 변경**: 마이그레이션 SQL을 직접 작성(`ALTER TABLE … ADD COLUMN …`) →
  `prisma db execute --file <sql> --url "$DIRECT_URL"`로 적용(이건 reset 안 함) → `prisma generate`.
  `migrate diff`를 프로덕션 대상으로 쓰지 말 것.
- **스키마 diff만 필요할 때**: DB를 건드리지 않는 파일-대-파일 diff 사용 —
  `prisma migrate diff --from-schema-datamodel <a.prisma> --to-schema-datamodel <b.prisma> --script`.
- shadow DB가 꼭 필요하면 **로컬/일회용 throwaway DB**만 지정. 프로덕션 URL 금지.

## 작업 전 필수 점검
1. DB URL이나 reset성 플래그가 포함된 명령은 **실행 전 대상이 프로덕션이 아닌지 반드시 확인**.
2. 변경은 **`--dry-run`/읽기 전용으로 먼저 검증** 후 적용.
3. 파괴적일 수 있는 작업은 **실행 전 사용자에게 확인**받는다.
4. 이 DB는 **동시에 ingest/크롤 프로세스가 쓰기**할 수 있다 — 단독 점유 가정 금지.

---

# 씽킹노트

현재 폴더에서 진행중인 프로젝트와 독립적으로 나와 클로드코드가 대화를 나누는 `_thinking` 이라는 폴더가 있어. (없다면 필요한 첫 순간에 만들어줘) 여기는 001, 002, 003, …마크다운 문서들을 쌓아나가는 공간이야. 내가 명시적으로 "001 문서로 저장" 같은 요청을 할 때만 저장해. 문서의 이름은 적당히 짧게 키워드로 잘 지어줘. 그리고 여기는 append-only 기반으로 되도록 기존 문서를 수정하지 않고 계속 쌓아나갈거야. 그리고 이 폴더는 모든 히스토리가 남기 때문에 명시적인 요청이 있는 상황에만 전체 또는 부분을 읽어.

---

# 소통 방식

1. **나는 비개발자다.** 개발 용어가 나오면 풀어서 쉽게 설명해줘. (예: "마이그레이션" → "데이터베이스 구조를 바꾸는 작업")
2. **매 작업 끝에 요약을 붙여줘.** 내가 뭔가 지시하면, 답변 마지막에 아래 형식으로 한 줄씩 요약해서 반환해줘:
   - **지시:** (내가 요청한 것 한 줄)
   - **결과:** (실제로 한 일 한 줄)
