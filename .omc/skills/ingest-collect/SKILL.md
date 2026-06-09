---
name: ingest-collect
description: >-
  인스타그램 계정의 게시물 캡션을 **무필터 전체**로 긁어 계정별 JSON 파일로만 저장하는
  수집 전용 스킬. 분류·payload 작성·DB 적재는 하지 않는다(그건 ingest-show 담당).
  무인(밤) 일괄 수집에 쓰고, 결과 JSON은 ingest-show의 입력이 된다.
  "캡션 수집" / "json 받아줘" / "collect captions" / "워치리스트 수집" 요청 시 사용.
triggers:
  - 캡션 수집
  - json 받아줘
  - json 수집
  - collect captions
  - 워치리스트 수집
  - 무인 수집
  - ingest collect
argument-hint: "<ig-handle | 여러 handle | 'watchlist'>"
---

# ingest-collect — 캡션 수집 전용

> **이 스킬은 "장보기"만 한다.** 인스타 캡션을 전체 받아 파일로 떨구는 것까지가 끝이다.
> **분류(KEEP/skip)·payload 작성·DB 적재는 절대 하지 않는다** — 그건 `ingest-show` 스킬이
> 이 결과 파일을 입력으로 받아 한다. 이 경계를 넘지 말 것(넘는 순간 통제가 무너진다).

## 왜 분리돼 있나

ingest 작업의 자의적 판단(어떤 게시물을 공연으로 볼지)은 **분류·적재 단계**에서 일어난다.
수집은 판단이 거의 없는 기계적 작업이므로 **무인으로 자율 실행**해도 안전하고, 분류·적재는
**사람이 감독**하는 게 맞다. 그래서 둘을 갈랐다:

| 단계 | 스킬 | 판단 | 실행 |
|---|---|---|---|
| 캡션 전체 수집 → JSON | **ingest-collect (이 문서)** | 거의 없음 | 무인 OK |
| 분류 → payload → 적재 → 포스터 | ingest-show | 많음 | 사람 감독 + 코드 게이트 |

수집 fetch 로직은 **`collect-captions.js` 한 파일에만** 산다(동결 정본). 이 스킬도, ingest-show도
그 파일을 참조한다. **즉흥적으로 fetch 루프를 새로 짜지 말 것** — 항상 그 파일을 주입해 쓴다.

## 출력 계약 (ingest-show가 읽는 입력)

계정별로 `~/Downloads/full-<handle>.json` 이 떨어지고, 후처리로 `/tmp/full-<handle>.json` 으로 옮긴다.
파일 형태:

```jsonc
{
  "handle": "band_lucy",
  "user_id": "31015217979",
  "media_count": 2795,          // 프로필이 신고한 총 게시물 수(검증 기준)
  "fetched": 2795,              // 실제 받은 수
  "complete": true,             // fetched >= media_count-3 이면 true
  "reachedEnd": true,
  "full_name": "LUCY(루시)",
  "profile_pic_url_hd": "https://...",  // 나중 프로필사진 패스 참조용(주소는 만료되니 즉시만 유효)
  "items": [
    { "sc": "DXtcZQvlFJq", "t": 1777453842, "mt": 1, "pt": null, "n": 1, "cap": "캡션 전문..." }
  ]
}
```

- **무필터 전체.** 키워드로 미리 거르지 않는다(909 후보처럼 추리지 말 것 — 그건 분류 단계 책임).
- 캡션(텍스트)만. 이미지 URL은 CDN에서 수 분 내 만료되므로 저장하지 않는다.

## 절차

### Step 1 — 브라우저 준비 (Claude in Chrome)
1. `tabs_context_mcp` 로 탭 확보(없으면 생성).
2. `https://www.instagram.com/{첫 handle}/` 로 navigate. (어떤 IG 페이지든 한 탭이면 됨 —
   fetch는 instagram.com 오리진에서 호출된다.)
3. 인스타 **로그인 세션이 있어야** 한다(쿠키). 비로그인이면 feed API가 0건일 수 있다.

### Step 2 — 동결 수집 JS 주입
`collect-captions.js`(이 스킬 폴더) **파일 전체**를 `javascript_tool` 로 주입한다.
→ `window.__COLLECT` 생성. **이 코드를 손으로 다시 쓰지 말 것.**

### Step 3 — 실행
```js
window.__COLLECT.run(["handle1","handle2", ...], { pageCap: 400 })
```
- 계정을 **순차로**(동시 X — 차단 위험) 긁고, 계정마다 끝나는 즉시 `full-<handle>.json` 을
  `~/Downloads`로 자동 저장한다.
- 페이싱 기본값: 페이지 간 550ms, 계정 간 2500ms. (느리지만 차단 회피 핵심.)

### Step 4 — 폴링 (★즉시 반환만★)
```js
window.__COLLECT.status()
```
- **긴 `await` 폴링 금지** — 페이지가 fetch로 바쁠 때 45s CDP 타임아웃에 걸린다.
  짧게 기다리려면 `new Promise(r=>setTimeout(()=>r(window.__COLLECT.status()), 20000))` 처럼
  **20초 이하**만. 그 이상은 즉시 반환으로 끊어서 여러 번 확인.
- `status().finished` 에 `handle: fetched/media_count` 가 쌓인다. `⚠INCOMPLETE` 표시 주목.

### Step 5 — 후처리 (파일 이동 + 검증)
모든 계정이 끝나면(`done:true`) 다운로드 폴더의 파일을 `/tmp`로 옮기고 건수를 검증한다:
```bash
node /Users/k5d/dev/mft/.omc/skills/ingest-collect/finalize.mjs
```
→ `~/Downloads/full-*.json` 을 `/tmp/`로 이동하고, 각 파일의 `fetched` vs `media_count` 를
출력한다. INCOMPLETE 계정은 따로 표시 → 그 계정만 재수집.

추가로 **수집한 계정을 DB의 `IngestSource` 테이블에 `collected`(처리 대기)로 등록**한다
(작업 대기열 관측용 — `/admin/ingest` 에서 "처리·적재할 JSON 목록"으로 보인다).
이건 인벤토리 등록일 뿐 **분류·적재가 아니다**(경계 유지). 적재가 끝나면 ingest-show가
`scripts/ingest.ts`에서 해당 행을 `loaded`(완료)로 도장찍는다. DB 연결이 없으면 등록만
건너뛰고 파일 이동은 정상 진행한다.

## 무인(밤) 실행 시 주의

> 수집 루프는 **인스타 탭 안에서** 돈다. 다음을 지키지 않으면 중간에 죽는다:
- **머신 절전 끄기** (`caffeinate -dimsu` 를 백그라운드로 띄워두면 좋다). 노트북이 자면 루프도 멈춘다.
- **Chrome 열어둠 + 인스타 로그인 유지.**
- 네트워크가 끊기면 그 계정은 `errors`에 남는다 → 아침에 그 계정만 재실행.
- **수집량은 "다음 며칠 안에 처리할 만큼"만.** 캡션은 스냅샷이라 유통기한이 있다(예정 공연
  누락·게시물 삭제). 200계정 받아두고 묵히면 뒤쪽은 다시 받아야 한다.

## 워치리스트 대상 뽑기

"워치리스트 수집"이면 DB `seedAccount`에서 대상 핸들을 뽑는다(보통 `lastFetched IS NULL`
또는 오래된 순). 조회 헬퍼:
```bash
cd /Users/k5d/dev/mft/packages/db && node --env-file=../../.env seed-manage.mjs list --status pending --limit 50
```
핸들 배열을 만들어 Step 3의 `run([...])` 에 넣는다.

## 이 스킬이 하지 않는 것 (경계)

- ❌ 게시물 분류(공연/페스티벌/셋리스트 판정) → ingest-show
- ❌ payload(JSON 적재용) 작성 → ingest-show
- ❌ `pnpm ingest` 실행 → ingest-show
- ❌ 포스터/이미지 다운로드 → ingest-show의 Pass 2 (KEEP 확정 후)
- ❌ 키워드 사전 필터(후보 추리기) → 무필터 전체가 원칙

수집이 끝나면 사용자에게 "N개 계정 / 총 M건 수집 완료, INCOMPLETE: [...]" 만 보고하고 멈춘다.
적재로 넘어가려면 사용자가 **ingest-show를 따로 호출**한다(감독 지점).
