---
name: ingest-show
description: >-
  IG 게시물(또는 웹 페이지)을 보고 공연(Show)·페스티벌(Festival)·관람정보(FestivalInfo)를
  구조화된 payload JSON으로 추출한 뒤 `scripts/ingest.ts`로 DB에 적재하는 워크플로우.
  한국 인디 공연·페스티벌 디스커버리 파이프라인의 수집 진입점.
---

# ingest-show

> **재구성 노트**: 이 파일은 `.gitignore`의 `.omc/skills/` 규칙 때문에 git에 한 번도
> 커밋되지 않았고 원본이 분실되었다. 본 문서는 `scripts/ingest.ts`의 zod 스키마·코드
> 주석(= 계약)과 `.omc/specs`·`.omc/plans` 설계 문서를 근거로 재작성한 것이다.
> 코드와 본 문서가 어긋나면 **`scripts/ingest.ts`가 정답**이다.

## 목적

에이전트가 인스타그램 공식 계정(페스티벌/공연장/아티스트) 또는 공식 웹페이지를 "보고",
거기서 공연·페스티벌·관람정보를 뽑아 **payload JSON 한 건**으로 만든 다음, 그 JSON을
`scripts/ingest.ts`에 흘려보내 DB(Festival / Show / Artist / Venue / FestivalInfo)에
멱등(idempotent) upsert 한다. 이미지가 있으면 Supabase Storage 업로드, 검색 인덱스
갱신, 감사 로그 기록까지 ingest 스크립트가 수행한다.

**역할 분리**: 이 스킬(에이전트)은 *추출 + payload 작성*만 책임진다. *적재*는
`scripts/ingest.ts`가, *교정 학습*은 `/admin/review` + `scripts/review-learn.ts`가 맡는다.

## 언제 쓰나

- "이 IG 계정/게시물에서 공연(또는 라인업) 긁어와 넣어줘"
- "○○ 페스티벌 관람정보(타임테이블·교통·규정 등) 수집"
- "아티스트 계정에서 페스티벌 출연 정보로 기존 라인업 보강"

크롤러 자동화(`packages/crawler`)와 달리, 이 스킬은 **에이전트가 직접 소스를 읽어**
정확도 높은 한 건을 만드는 수동/반자동 경로다.

## 실행 방법

```bash
# 권장: run-ingest.sh 래퍼 (Node 22 보장 + .env 자동 로드)
pnpm ingest payload.json
pnpm ingest --dry-run payload.json        # DB 변경 없이 검증만

# 동등한 직접 실행
pnpm tsx scripts/ingest.ts payload.json
pnpm tsx scripts/ingest.ts < payload.json
```

- 인자는 **`.json`으로 끝나는 파일 경로** 또는 **stdin**. 둘 다 없으면 종료(exit 2).
- `DIRECT_URL` 환경변수 필요(없으면 종료). 래퍼가 `.env`를 로드한다.
- `--dry-run`: upsert/업로드를 실제로 하지 않고 경고·계획만 출력. **항상 dry-run으로
  먼저 검증**한 뒤 실 적재를 권장.

> 이 머신은 기본 `node`가 Homebrew 25라 tsx/Prisma가 hang 한다. 반드시 `pnpm ingest`
> 래퍼(nvm Node 22)를 쓸 것. 직접 tsx 호출 시 Node 22 활성화 확인.

## Payload 계약 (zod 스키마 = `scripts/ingest.ts`)

```jsonc
{
  "source": {
    "type": "ig_post",          // 'ig_post'(기본) | 'web_page' | 'manual'
    "accountHandle": "string?",  // 예: "pentaport_official" (@ 없이)
    "postUrl": "https://...?",   // 게시물 URL (있으면 최우선 키)
    "shortcode": "string?",      // IG /p/{shortcode}
    "capturedAt": "ISO?"
  },
  "entities": [ /* 아래 4종 중 하나 이상 */ ],
  "notes": "string?",
  "reviewerConfidence": "high | medium | low?"
}
```

`entities[]`는 `kind`로 구분되는 discriminated union 4종:

### 1) `kind: "show"` — 단독공연 / 페스티벌 내부 공연

```jsonc
{
  "kind": "show",
  "title": "string?",
  "sessions": [                       // v6: "1 캘린더 공연 = 1 session"
    {
      "date": "YYYY-MM-DD",           // 필수
      "startTime": "HH:MM?",
      "endTime": "HH:MM?",
      "ticketUrl": "https://...?",
      "ticketOpenAt": "ISO datetime?",
      "capacity": 0,
      "notes": "string?"
    }
  ],
  "venueText": "string?",             // 공연장 원문 (canonicalize됨)
  "venueRegion": "string?",
  "artists": [{ "name": "필수", "igHandle": "?", "aliases": ["?"] }],
  "festivalKey": "string?",           // 페스티벌 내부 공연이면 부모 festival key
  "ticketUrl": "https://...?",
  "imageSource": "string?",           // URL/경로 → Supabase Storage 업로드
  "stage": "string?",
  "setOrder": 0
}
```

- **deprecated** 최상위 `date`/`startTime`은 그대로 받되 `sessions[0]`로 자동 승격
  (경고 출력). 신규 작성은 **반드시 `sessions[]`** 사용.
- **다일(multi-day) 동명 공연은 절대 N개 show로 쪼개지 말 것** → 1개 show에 N개
  session으로 넣는다. (dedupe 핵심 규칙)
- `festivalKey`가 있으면 페스티벌 내부 공연으로 취급되어 부모 페스티벌 값(이름·장소·
  티켓·이미지)을 상속한다.

### 2) `kind: "festival"`

```jsonc
{
  "kind": "festival",
  "name": "필수",
  "year": 2026,                       // 2000~2030
  "startDate": "YYYY-MM-DD?",
  "endDate": "YYYY-MM-DD?",
  "locationText": "string?",
  "officialUrl": "https://...?",
  "ticketUrl": "https://...?",
  "posterImageSource": "string?",     // → Storage 업로드
  "description": "string?",
  "igHandle": "string?"
}
```

- 식별 키: `festivalStrongKey(name, year)` = 이름에서 연도 제거·공백 제거·소문자화·
  특수문자 제거(한글 보존) + `__{year}`. 같은 페스티벌의 같은 해는 한 행으로 수렴.
- 내부 공연을 함께 넣을 때, show 엔티티의 `festivalKey`를 이 페스티벌과 매칭되게 둘 것.

### 3) `kind: "festival_info"` — 관람정보

```jsonc
{
  "kind": "festival_info",
  "festivalKey": "필수",
  "category": "MAP | TIMETABLE | ACCESS | RULES | FAQ | GOODS | AMENITY | NOTICE",
  "title": "string?",
  "sourcePostUrl": "https://...?",    // @unique 멱등 키
  "imageSources": ["url", "..."],     // 여러 장 업로드 (예: 타임테이블 이미지)
  "bodyText": "string?",
  "postedAt": "ISO?",
  "order": 0
}
```

- `sourcePostUrl` 미지정 시 `originalPostUrl(source, "info-<category>")`로 안정화되어
  category당 1행이 멱등 유지된다.

**카테고리 분류 가이드** — 포스트의 *주된 정보*로 판정:

| 신호 | category |
| --- | --- |
| 사이트맵 · 배치도 · 부스맵 · 시설 위치도 | `MAP` |
| 타임테이블 · 러닝오더 · 요일/스테이지별 출연표 | `TIMETABLE` |
| 교통 · 주차 · 셔틀버스 · 오시는 길 | `ACCESS` |
| 입장 규정 · 반입 금지 물품 · 재입장 · 연령 제한 | `RULES` |
| 자주 묻는 질문 · Q&A | `FAQ` |
| MD/굿즈 판매 · 푸드트럭 · F&B 라인업 | `GOODS` |
| 편의시설 · 물품보관 · 우천 대비 · 구급/의무실 | `AMENITY` |
| 그 외 관람객 안내 공지 | `NOTICE` |

**수집 경계 (중요)** — `festival_info`는 **관람객에게 필요한 정보만** 모은다.

- ✅ **수집**(관람객 대상): 사이트맵 · 타임테이블 · 교통/주차 · 입장/반입 규정 · FAQ ·
  MD/굿즈·푸드트럭 · 편의시설/우천.
- ⛔ **skip**(관람객 대상 아님): 업체·F&B 부스 **모집**, 경연·공모·서포터즈·스태프 **모집**,
  스폰서 콜라보 홍보, 리캡·아프터무비·회고, 단순 티저/카운트다운.
- 라인업 **발표** 포스트는 `festival_info`가 아니라 `show`(+필요 시 `festival`)로 추출한다.
- 애매하면 `confidence`를 낮추고 `NOTICE`로 두되, 모집/홍보성으로 판단되면 차라리 skip.

### 4) `kind: "setlist"` — 아티스트 계정발 셋리스트 비파괴 보강

```jsonc
{
  "kind": "setlist",
  "festivalKey": "필수",
  "artistName": "필수",
  "date": "YYYY-MM-DD",               // 필수
  "songs": [                          // 최소 1곡 (.min(1))
    { "title": "필수", "isEncore": false, "coverOf": "원곡자?" }
  ],
  "sourceNotes": "string?"
}
```

- **아티스트 계정을 크롤할 때 사용.** 셋리스트는 페스티벌 포스터엔 없고 아티스트 글에서만
  얻는 정보다. **새 Show를 만들지 않고**, `festivalKey(canonicalKey) + artistName(canonical)
  + date(session)`로 기존(페스티벌 계정이 만든) Show를 찾아 셋리스트만 붙인다.
- 매칭 실패 시 **skip**(새로 안 만듦). 해당 Show에 **이미 셋리스트가 있으면 skip**(운영자
  편집 보호 — 덮어쓰지 않음). 운영자 편집은 `/admin/setlists`.
- 라인업·공연의 1차 원천은 항상 **페스티벌 계정**이라는 원칙을 지키기 위함.
- ⚠️ **아티스트 계정의 "페스티벌 출연" 글로 `show` 엔티티를 만들지 말 것.** Show 자연 키는
  게시물 URL이라, 아티스트 게시물로 show를 만들면 페스티벌 계정이 만든 동일 공연과 **중복**
  된다(ingest는 자동 병합하지 않음). 아티스트 계정에선 그 출연 공연에 대해 **`setlist`만**
  emit한다(셋리스트가 없으면 아무것도 emit하지 않는다). 단독 공연/투어는 정상적으로 `show`.

> 참고: 적재는 다른 엔티티(festival → show → festival_info)를 모두 처리한 **마지막 pass**에서
> 실행된다(기존 Show가 있어야 매칭되므로).

## 멱등성 / dedupe 규칙 (꼭 지킬 것)

- **Show 자연 키 = `originalPostUrl`**: 우선순위 `source.postUrl` → `https://www.instagram.com/p/{shortcode}/` → `https://www.instagram.com/{accountHandle}/#{anchor}`. 같은 게시물 재적재 시 같은 키 → 중복 없이 갱신.
- **Festival 키 = `festivalStrongKey(name, year)`** (위 참조).
- **FestivalInfo 키 = `sourcePostUrl`** (@unique).
- 다일 공연 = 단일 show + 다중 session (위 참조).
- 아티스트/공연장 이름은 ingest가 `correction-map.json`(있으면)으로 결정적 치환한다.
  → 추출 시 표기가 흔들려도 OK; 사람 교정이 누적되면 자동 보정됨.

## 추출 워크플로우 (에이전트 절차)

1. **소스 결정**: 페스티벌 계정 → festival + 내부 show + festival_info. 공연장 계정 →
   단독 show. 아티스트 계정 → setlist(기존 페스티벌 Show에 셋리스트 보강).
2. **소스 열람**: IG 게시물/프로필 또는 공식 웹페이지의 캡션·이미지·날짜를 읽는다.
   (브라우저 도구가 필요할 수 있음.)
3. **엔티티 추출**: 위 4종 스키마로 매핑. 날짜는 `YYYY-MM-DD`, 시간은 `HH:MM`.
   확신이 낮은 필드는 비우고(추측 금지) `reviewerConfidence`를 낮춘다.
4. **이미지**: 포스터/타임테이블 이미지 URL을 `imageSource(s)`/`posterImageSource`에.
5. **payload.json 작성** → `pnpm ingest --dry-run payload.json`으로 검증.
6. 경고 해소 후 `pnpm ingest payload.json` 실 적재.
7. 결과는 `/admin/review`에서 사람이 검토·교정 → `scripts/review-learn.ts`가
   `correction-map.json`을 갱신해 다음 ingest 품질을 끌어올린다.

## 예시: 펜타포트 페스티벌 + 내부 공연 + 타임테이블

```json
{
  "source": {
    "type": "ig_post",
    "accountHandle": "pentaport_official",
    "postUrl": "https://www.instagram.com/p/XXXXXXX/"
  },
  "reviewerConfidence": "high",
  "entities": [
    {
      "kind": "festival",
      "name": "인천 펜타포트 락 페스티벌",
      "year": 2026,
      "startDate": "2026-08-07",
      "endDate": "2026-08-09",
      "locationText": "인천 송도 달빛축제공원",
      "igHandle": "pentaport_official",
      "posterImageSource": "https://.../poster.jpg"
    },
    {
      "kind": "show",
      "festivalKey": "인천펜타포트락페스티벌__2026",
      "title": "헤드라이너 A",
      "stage": "Pentaport Stage",
      "sessions": [{ "date": "2026-08-08", "startTime": "21:00" }],
      "artists": [{ "name": "헤드라이너 A" }]
    },
    {
      "kind": "festival_info",
      "festivalKey": "인천펜타포트락페스티벌__2026",
      "category": "TIMETABLE",
      "title": "DAY2 타임테이블",
      "imageSources": ["https://.../timetable_day2.jpg"]
    }
  ]
}
```

## 주의

- 추측으로 날짜/라인업을 채우지 말 것. 모르면 비우고 confidence를 낮춘다.
- `--dry-run` 검증을 건너뛰지 말 것.
- `festivalKey`는 festival 엔티티의 `festivalStrongKey`와 정확히 일치해야 내부 공연이
  부모에 붙는다(불일치 시 고아 show 생성).
- IG 공개 데이터 수집은 best-effort이며 차단·구조 변동이 잦다. 적재 전 사람 검토 전제.
