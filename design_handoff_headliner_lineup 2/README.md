# Handoff: Headliner — Show Detail "라인업 블록" 추가

## Overview
공연 상세 페이지(`/shows/[id]`)에서 **페스티벌 소속 공연**일 때 SetlistSection 자리에 표시되는 **LineupSection** 추가.
**작업 전 반드시 `DESIGN_SYSTEM.md`를 먼저 읽으세요.**

## About the Design Files
폴더의 HTML은 **디자인 레퍼런스**입니다 — 의도된 룩·동작을 보여주는 프로토타입이지 그대로 복사할 프로덕션 코드가 아닙니다.
타겟 코드베이스(Next.js 15 + Tailwind CSS) 환경에서 같은 디자인을 재현하세요.

- 시안의 placeholder들(`<HeaderPlaceholder />`)은 기존 컴포넌트의 위치 표시. 새로 만들지 말고 import.
- mock 데이터(`PENTAPORT_LINEUP`)는 인라인. 프로덕션은 API에서 fetch.
- 페이지 상단의 데모 토글(`단독 공연 / 페스티벌 소속 / 셋리스트 미등록`)은 시안 미리보기용. **프로덕션에 들어가지 않음.**

## Fidelity
**High-fidelity.** 색·간격·타이포 모두 의도된 최종 값.

---

## What changed in Show Detail

기존 Show Detail 페이지 구조는 그대로. 페이지 끝의 `<SetlistSection />` 자리에서:

```tsx
{show.festival && show.lineup
  ? <LineupSection lineup={show.lineup} festivalName={show.festival.name} />
  : <SetlistSection setlist={show.setlist} />}
```

- `show.festival`이 있고 `show.lineup`이 있으면 → **LineupSection** 렌더
- 그렇지 않으면 → 기존 **SetlistSection** 렌더

데모 토글 `페스티벌 소속`을 누르면 변경된 동작이 표시됩니다.

---

## LineupSection 사양

### Data Model

```ts
type Lineup = {
  totalArtists: number;        // 예: 38
  thisArtist?: string;         // 현재 보고 있는 공연의 아티스트명
  days: LineupDay[];
};

type LineupDay = {
  label: string;               // "DAY 1"
  date: string;                // "2026.08.08"
  dayKr: string;               // "FRI"
  hereArtist?: string;         // 이 날 출연하는 thisArtist (있으면 표시)
  artists: string[];           // 아티스트 명단 (순서 = 출연 순서 또는 의도된 위계)
};
```

> **시간·스테이지 데이터 없음.** 의도적으로 단순화. 디테일은 페스티벌 상세 페이지(추후)에서 다룰 예정.

### Layout

```
LINEUP (kicker)
라인업  38팀                                  페스티벌 전체 보기 ↗
─────────────────────────────────────────────────────────────────
DAY 1   08.08  FRI
[ IDLES ] [ Wet Leg ] [ 검정치마 ] [ 잠비나이 ] [ 새소년 ] ...

DAY 2   08.09  SAT                          • 이 날 공연
[ Mac DeMarco ] [ hyukoh ] [ 잔나비 ]
[ ◉ 실리카겔 THIS SET ] [ Wave to Earth ] [ 백예린 ] ...

DAY 3   08.10  SUN
[ Phoenix ] [ 검정치마 ] [ 루시드 폴 ] ...
─────────────────────────────────────────────────────────────────
• THIS SET — 지금 보는 공연        라인업은 변경될 수 있습니다.
```

### 핵심 결정 사항 (의도적으로 빠진 것들)
- **헤드라이너 시각 위계 없음** — 모든 칩이 동일한 크기·스타일. 위계가 필요하면 라인업 순서로만 표현.
- **시간 정보 없음** — 셋리스트가 곡 순서를 다루듯, 라인업은 명단만 다룸.
- **스테이지 구분 없음** — 단순화. 페스티벌 상세에서 다룰 정보.
- **데이 탭 없음** — 모든 데이를 한 화면에 펼침. 페스티벌은 보통 2~3일이라 스크롤로 충분.

### 시각 사양

#### 헤딩
- kicker `LINEUP` — 11px tracking-[0.3em] uppercase paper/45
- h2 `라인업` — 28–34px font-bold tracking-[-0.025em] paper
- count `N팀` — 14px tabular-nums paper/40
- 우측 링크 `페스티벌 전체 보기 ↗` — 11px tracking-[0.2em] uppercase paper/55, 기존 `.ext` 패턴 재사용
- 하단 hairline

#### Day group header
- 위에 hairline + pb-3
- 좌: `DAY N` (11px tracking-[0.3em] uppercase paper/45)
- 그 옆: `MM.DD` (Big Shoulders 22px, dot은 paper/45)
- 그 옆: `FRI / SAT / SUN` (12px tracking-[0.18em] uppercase paper/55)
- 우(있을 때): `• 이 날 공연` (10px tracking-[0.22em] uppercase lime + lime dot)

#### Artist chip
- height **36px**, `padding: 0 14px`, `border-radius: 6px`
- gap **8px** (flex-wrap)
- 일반:
  - `border: 1px solid rgba(255,255,255,0.15)`
  - text 14px paper/85 tracking-[-0.005em]
  - hover: border `rgba(255,255,255,0.40)`, text paper
- **이 공연** (== `hereArtist`):
  - text `lime` (#d4ff4d)
  - border `rgba(212,255,77,0.7)`
  - bg `rgba(212,255,77,0.06)`
  - `THIS SET` 라벨 (9px tracking-[0.22em] uppercase) 우측에 부착

#### Footer 노트
- 좌: lime dot + `THIS SET — 지금 보는 공연` 범례
- 우: `라인업은 변경될 수 있습니다.` (paper/30)

---

## Interactions

- **Chip hover**: border 강조 + text 강조 (transition 200ms)
- **Chip click**: 해당 아티스트 페이지로 이동 (`/artists/[id]`). 시안에서는 `<a href="#">` placeholder.
- **`이 공연` 칩**: 자기 자신 → 클릭 비활성 또는 disabled scroll
- **`페스티벌 전체 보기 ↗`**: `/festivals/[id]`로 이동

---

## 새로 만들 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `LineupSection` | `components/show/LineupSection.tsx` | 헤딩 + 데이별 그룹 + footer |
| `LineupDayHeader` | `components/show/LineupDayHeader.tsx` | 데이 라벨 + 날짜 + 이 날 마커 |
| `ArtistChip` | `components/common/ArtistChip.tsx` | 라운드 사각형 칩. **재사용 권장** — 다른 페이지에서도 아티스트 명단이 등장할 수 있음 |

`ArtistChip`은 `<Link href={\`/artists/\${id}\`}>` 래퍼로 만들고, `variant="default" | "here"` props로 분기.

---

## Design Tokens (사용된 것만)

| Token | Value | 용도 |
|---|---|---|
| `paper/85` | rgba 0.85 | 칩 텍스트 |
| `paper/55, /45` | — | 데이 라벨, kicker |
| `paper/40, /30` | — | 카운트, 푸터 |
| `lime` | `#d4ff4d` | 이 공연 칩 텍스트·보더·dot |
| `border-white/15` | rgba 0.15 | 칩 기본 보더 |
| `border-white/40` | rgba 0.40 | 칩 hover 보더 |
| hairline | `rgba(255,255,255,0.06)` | 데이 그룹 구분선 |

**Border-radius**: `6px` (= `rounded-md`, PosterCard와 동일 라디우스)

---

## 확인 필요 (미정 사항)

| # | 항목 | 시안 기본값 | 결정 필요 |
|---|---|---|---|
| 1 | 아티스트 순서 | 데이터 순서 그대로 (헤드라이너 → 미들 → 서포팅 라인업) | 가나다순으로 정렬할지 |
| 2 | 데이별 카운트 | 표시 안 함 | 데이마다 `N팀` 표시할지 |
| 3 | `이 공연` 칩이 클릭됐을 때 | placeholder | 자기 페이지로 새로고침? 아니면 비활성? |
| 4 | 라인업이 너무 길 때 (50+) | 그대로 펼침 | 데이별로 접기/펼치기 토글 추가할지 |
| 5 | 시간/스테이지 정보 | 의도적으로 빠짐 | 페스티벌 상세 페이지가 생기면 거기 노출 |

---

## Files in this Handoff

| 파일 | 설명 |
|---|---|
| `README.md` | 이 파일 |
| `DESIGN_SYSTEM.md` | **반드시 먼저 읽기** |
| `Headliner Lineup.html` | LineupSection 단독 미리보기 진입점 |
| `lineup-section.jsx` | LineupSection · ArtistChip · LineupDayHeader 컴포넌트 + mock 데이터 |
| `icons/` | favicon 세트 |
