# 단독공연 / 페스티벌 / 페스티벌 내부 공연 분리 계획

> 상태: **계획(Planning)** — 구현 전. 결정 합의 기록용.
> 작성: 2026-05-31

현재 "공연 / 페스티벌 / 페스티벌 내부 공연"이 뷰·데이터 양쪽에서 혼재. 이를
**명칭 → 컴포넌트(뷰) → 데이터 모델** 순으로 분리한다.

---

## 0. 용어 정의 (합의)

| 용어 | 정의 | 데이터 기준 |
|---|---|---|
| **단독공연** | 페스티벌에 속하지 않은 독립 공연 | `Show.festivalId == null` |
| **페스티벌** | 여러 공연을 묶는 상위 컨테이너 | `Festival` 행 |
| **페스티벌 내부 공연** (라인업 child) | 특정 페스티벌에 속한 하위 공연 | `Show.festivalId != null` |

---

## 1. 컴포넌트(뷰) 정리 — ✅ 완료

그리드 뷰가 2벌(`UpcomingSection` + `ShowsGrid`)로 중복돼 있던 것을
**공유 컴포넌트 1벌로 통합**.

- **카드 1장**: `PosterCard` (윗줄 `primaryName` + 밑줄 `secondaryTitle` 2단 슬롯)
- **공유 그리드**: `ShowsGrid` (kicker + title + 4컬럼)
- `UpcomingSection` **삭제** → `ShowsGrid`에 `headerAction?: { label, href }` prop 추가해 흡수

### 면(surface)별 정책 — 페스티벌 내부 공연 노출 여부

| 화면 | 페스티벌 내부 공연 | 근거 |
|---|---|---|
| 홈 "다가오는 공연" | **숨김** | 쿼리 `where festivalId: null` |
| `/shows` 리스트 | **숨김** | `lib/listings.ts` `festivalId: null` |
| 아티스트 상세 | **보임 + 페스티벌명 강조** | "이 아티스트가 OO페스티벌 출연"이 핵심 정보 |
| 검색 결과 | **미확인 — 점검 필요** | `festivalId: null` 필터 없을 가능성 (아래 5번) |

> **원칙**: "무엇을 보여줄지"는 **데이터/쿼리 레이어가 결정**한다.
> `ShowsGrid`는 받은 걸 그대로 그리는 멍청한 뷰로 유지 — 도메인 필터를 넣지 않는다.
> (애초에 `ShowsGridItem`은 `festivalId`를 들고 있지 않음)

---

## 2. 데이터 상속 모델 (페스티벌 내부 공연 → 부모 페스티벌)

라인업 공연마다 이미지·정보를 따로 등록시키지 않고, **부모 페스티벌 값을 끌어온다.**

### 방식: 읽기 시점 fallback (Approach A) — ✅ 합의

```ts
const img = show.imageUrl ?? show.festival?.posterImageUrl ?? null;
```

- 값을 **복사·저장하지 않음** (denormalize ✗). 단일 출처(SSOT) 유지.
- 페스티벌 포스터 교체 시 → 모든 라인업에 **자동 반영**, 동기화 코드 불필요.
- child가 자기 값을 채우면 그게 우선(override 가능).
- 비용: 읽을 때 `festival.*` join 1개 — 헬퍼로 캡슐화.

### 필드별 상속 매트릭스

| 필드 | 상속 | 규칙 |
|---|---|---|
| **이미지** | ✅ fallback | `show.imageUrl ?? festival.posterImageUrl` |
| **장소(venue/locationText)** | ✅ fallback | `show.venue ?? festival.venue` / `festival.locationText` |
| **티켓(ticketUrl)** | ✅ fallback | `show.ticketUrl ?? festival.ticketUrl` |
| **공식 링크(officialUrl)** | △ 약한 fallback | 필요 시 |
| **이름/타이틀** | **derive (저장 X)** | 아래 3번 참조 |
| 날짜(sessions/firstSessionDate) | ❌ | child가 더 구체적("며칠차 어느 스테이지"). 비었을 때만 `festival.startDate` 약한 fallback |
| 아티스트 / 스테이지 / setOrder | ❌ | 라인업 고유 식별자 |
| status / completeness / needsReview | ❌ **절대 X** | 거버넌스 필드, child 독립 판단. "페스티벌 승인 → 라인업 자동 승인"은 별개 정책 |
| description | ❌ | 공연별 상이 |

---

## 3. 이름(타이틀) 처리 — ✅ 합의

페스티벌 내부 공연은 **자기만의 `title`이 없다.** `Show.title`은 비워두는 게 정상.
표시명은 저장하지 않고 **표시 시점에 유도**한다. `PosterCard`의 2단 슬롯 활용:

```
primaryName   (윗줄, 굵게) = 페스티벌 이름
secondaryTitle(밑줄, 흐림) = 아티스트 이름  ← 카드 간 구분자
```

```ts
primaryName:    show.festival.name,
secondaryTitle: show.artists[0]?.canonicalName,
```

### 화면별 예외

| 화면 | 윗줄(primaryName) | 밑줄(secondaryTitle) |
|---|---|---|
| 기본(아티스트 상세·검색·스크랩) | 페스티벌 이름 | 아티스트 |
| **페스티벌 상세 라인업** | **아티스트** (페스티벌명 반복은 군더더기) | 스테이지/시간 등 |

---

## 4. 구현 항목

1. ✅ **상속 헬퍼 신설** — `apps/web/lib/festivalInheritance.ts`
   `inheritImage` / `inheritVenue` / `inheritTicketUrl` / `inheritCardName` (순수 함수, 읽기 시점 fallback)
2. ✅ **읽기 경로 select에 부모 페스티벌 필드 추가** (`posterImageUrl`, `ticketUrl`, `locationText`, `venue{name,region}`)
   - `app/shows/[id]/page.tsx` (상세)
   - `app/artists/[id]/page.tsx` (아티스트 카드)
   - `app/page.tsx` (홈 검색 결과 카드)
3. ✅ **상속 배선 완료** — 페스티벌 내부 공연이 렌더되는 3개 면 전부 헬퍼 통과
   - **상세**: 이미지(PosterColumn) · 장소(InfoColumn) · 티켓(세션 fallback)
   - **아티스트 카드**: 이미지 · 장소 (이름은 기존 페스티벌명 강조 유지)
   - **홈 검색 카드**: 이미지 · 장소 · 이름(윗줄=페스티벌명, 밑줄=아티스트)
4. ⬜ **페스티벌 상세 라인업** 카드 매핑은 윗줄=아티스트로 분기 (해당 페이지 작업 시)
5. ✅ **크롤러 completeness 보정** — `scripts/ingest.ts`: 페스티벌 내부 공연은
   `venueId || festivalId`로 venue 차원을 충족 처리 → 라인업 공연이 'venue 누락'으로
   리뷰 큐를 오염시키지 않음
6. ✅ **추출 프롬프트 가드 노트** — `extract-festival.ts`: 라인업 set은 이미지·장소·티켓을
   복사/생성하지 말 것(부모에서 상속) 명시

> 상속 대상: **이름 · 장소(venue) · 티켓 · 이미지**. 날짜·아티스트·스테이지·status는 상속하지 않음.

---

## 6. 미해결 / 확인 필요

- **검색 결과(`q` 있을 때)** 페스티벌 내부 공연이 새는지 점검 → 새면 쿼리에 `festivalId: null` 또는 정책 통일 헬퍼 적용
- **페스티벌 상세 라인업**에서 각 공연 카드에 이미지를 띄울지(다 같은 포스터면 단조 → 이미지 대신 아티스트/스테이지 위주 카드 고려)
- 진행 중인 `add_festival_info` 마이그레이션은 별개 작업 (이 계획과 무관, 단 `prisma generate` 미실행 상태라 tsc 에러 존재)
