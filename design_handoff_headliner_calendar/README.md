# Handoff: Headliner — 공연 캘린더 (`/calendar`)

## Overview
홈 / 검색 / 상세 페이지에 이은 **공연 캘린더 페이지** 디자인 핸드오프입니다.
사용자가 "이번 달에 어떤 공연이 있나"를 한눈에 보기 위한 페이지.
**작업 전 반드시 `DESIGN_SYSTEM.md`를 먼저 읽으세요.**

## About the Design Files
폴더의 HTML은 **디자인 레퍼런스**입니다 — 의도된 룩·동작을 보여주는 프로토타입이지, 그대로 복사할 프로덕션 코드가 아닙니다.
타겟 코드베이스(Next.js 15 + Tailwind CSS) 환경에서 같은 디자인을 재현하세요.

특히:
- 프로토타입은 React + Babel을 CDN으로 로드. 프로덕션은 Next.js App Router로 구현.
- 시안 안의 placeholder들(`<HomeHeaderPlaceholder />`, `<BackLinkPlaceholder />`)은 **이미 구현된 컴포넌트의 위치 표시**입니다. 새로 만들지 말고 코드베이스의 기존 컴포넌트를 import하세요.
- mock 데이터는 `calendar-app.jsx` 안에 인라인. 프로덕션은 API에서 fetch.

## Fidelity
**High-fidelity.** 색·간격·타이포·인터랙션 모두 의도된 최종 값.

---

## Page — Calendar (`/calendar`)

홈 헤더 nav의 "공연" 또는 별도 진입점에서 도달.
**기본 뷰: 월 그리드** (Google Calendar 형태). 리스트·하이브리드 안은 기각.

### 결정한 이유 (참고용)
- 한국 인디 씬 ~6–15건/월 규모는 그리드 셀에 무리 없이 들어감
- 페스티벌의 "다일 연속" 시각화가 가로 span으로 자연스럽게 표현됨
- 주말 집중도와 빈 주가 한눈에 보임 (정보 밀도 1순위)
- 모바일은 같은 페이지에서 **수직 리스트로 fallback** (이 핸드오프에는 시안 없음 — 추후 작업)

### Data Model

```ts
type Event = {
  id: string;
  kind: 'SHOW' | 'FESTIVAL';
  primaryName: string;        // "실리카겔" 또는 "2026 펜타포트"
  secondaryTitle: string | null;
  poster: string | null;
  // SHOW: 단일 또는 다일 (투어 — 같은 공연을 여러 도시/날짜)
  // FESTIVAL: 연속 다일 (라인업이 여러 날에 걸침)
  sessions: {
    date: string;             // 'YYYY-MM-DD'
    startTime: string | null; // 'HH:MM'
    venue: string;
    city: string | null;
  }[];
};
```

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  <HomeHeader />                                  72px   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   <BackLink />  ← 검색으로                              │
│                                                         │
│   ┌─ MonthNav ───────────────────────────────────────┐ │
│   │ 공연 캘린더 / UPCOMING                            │ │
│   │ 2026. 06   이번 달 6건       ‹ ›  [6월][7월]… 오늘│ │
│   ├──────────────────────────────────────────────────┤ │
│   │  SummaryStrip  · 4 cells · 총/단독/페스티벌/주말  │ │
│   ├──────────────────────────────────────────────────┤ │
│   │  MonthGrid                                       │ │
│   │  일  월  화  수  목  금  토                       │ │
│   │  ──────────────────────────────────────────      │ │
│   │  ┌──┬──┬──┬──┬──┬──┬──┐                          │ │
│   │  │ 1│ 2│ 3│ 4│ 5│ 6│ 7│   ← 132px 셀 높이        │ │
│   │  │  │  │  │  │  │  │■■│      ■ = 이벤트 바       │ │
│   │  │  │  │■■■■■■■■■■■■│      ■ = 다일 가로 span   │ │
│   │  │  │  │  │  │  │  │  │                          │ │
│   │  └──┴──┴──┴──┴──┴──┴──┘                          │ │
│   │  …                                               │ │
│   ├──────────────────────────────────────────────────┤ │
│   │  Legend · SHOW / FEST / 1/3 투어 / 오늘 (lime)   │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Sections

#### 1. MonthNav (캘린더 헤더)
- **왼쪽**:
  - 키커 — `공연 캘린더 / UPCOMING` (paper/45, 10px, tracking-[0.3em] uppercase)
  - 타이틀 — `2026. 06` (Big Shoulders Display 900, 64px, paper)
  - 부제 — `이번 달 6건` (13px, tracking-[0.18em] uppercase, paper/45)
- **오른쪽** — 컨트롤 row:
  - prev/next 화살표 (각 36×36, `border-white/10` → hover `border-white/30`)
  - 분기 jump segmented control (`6월 / 7월 / 8월 / 9월`) — 활성: `bg-paper text-ink-900`, 비활성: `text-paper/55`
  - "오늘" 버튼 — 동일 outline 스타일

#### 2. SummaryStrip
- `grid-cols-4`, 셀 사이 1px gap (`bg-white/[0.06]` 배경에 ink-900 셀로 hairline 만들기)
- 각 셀: `px-5 py-4`
  - 라벨 (paper/40, 10px tracking-[0.3em] uppercase)
  - 값 (Big Shoulders 900, 32px) + 보조 (paper/40, 11px tracking-[0.18em] uppercase)
- 4개 항목: **총 이벤트** / **단독공연** / **페스티벌** / **주말 공연**
- 값은 현재 뷰 월 기준으로 계산

#### 3. MonthGrid
**구조**: `grid-cols-7` × 5~6 행. 일요일 시작 (DOW_KR = ['일','월','화','수','목','금','토']).

**Day-of-week header** (위 36px):
- 평일: paper/35, 주말(일·토): paper/55
- 10px tracking-[0.3em] uppercase
- 셀 사이 hairline (inset `-1px 0 0 rgba(255,255,255,0.06)`)

**날짜 셀** (`min-height: 132px`, `padding: 10px 12px 8px`):
- 셀 사이 hairline (오른쪽·아래)
- 다른 달 날짜: `opacity: 0.35`
- 날짜 숫자:
  - 과거 + 같은 달 = paper/30 (dim 처리)
  - 주말 = paper/90
  - 평일 = paper/70
  - 13px, tabular-nums
- 매월 1일 옆에 작은 `6월` 라벨 (paper/30, 9px tracking-[0.22em] uppercase)
- **오늘** 표시: 날짜 옆에 1.5px lime dot (`bg-lime`, `box-shadow: 0 0 0 2px rgba(212,255,77,0.18)`)

**이벤트 바** (셀 위에 absolutely positioned):
- 한 주(row) 단위로 lane 할당 — 최대 3 lane 표시, 초과는 `+N건 더보기`
- Bar 높이 22px, lane 간격 4px, top = `26 + lane * 26`
- 가로: `left: (startCol/7)*100% + 6px`, `width: (span/7)*100% - 12px`
- **SHOW** (채움): `bg-white/[0.08]` → hover `bg-white/[0.14]`, 텍스트 paper
- **FESTIVAL** (아웃라인): `border border-paper/40` → hover `border-paper/80`, `bg-black/20`
- 좌/우 border-radius는 주 경계에서 잘렸을 때만 0 (이어지는 느낌)
- 내용:
  - 1px×1px 타입 dot (FEST: paper/80, SHOW: paper/60)
  - 이벤트 이름 (11px font-medium, truncate)
  - 다일 페스티벌: `3일` 라벨 (9px tracking-[0.12em], paper/55)
  - 투어 회차: `1/3` 라벨
  - 주 경계 왼쪽 잘림: `...` 라벨
- hover 상태: 그룹 hover로 bar 강조

**다일 이벤트 시각화 — 핵심 규칙**:
- **연속된 같은 venue 세션** = 하나의 블록, 가로 span 바로 렌더 (페스티벌)
- **비연속 또는 다른 venue 세션** = 각각 별도 블록, `i/total` 라벨 (투어)
- 주 경계를 넘는 블록은 자동으로 끊김 + 양쪽에 leftClipped/rightClipped 표시

**오버플로**: 같은 셀에 lane 4개 이상이면, 4번째부터는 `+N건 더보기` 텍스트 링크로 대체 (셀 하단)

#### 4. Legend
- 4개 항목 inline-flex row
- 10px tracking-[0.22em] uppercase paper/45

---

## Interactions & Behavior

- **prev/next 버튼**: 한 달씩 이동, URL `?month=2026-07` 갱신
- **분기 jump 버튼**: 해당 월로 직접 이동
- **"오늘" 버튼**: 현재 달로 점프
- **이벤트 바 클릭**:
  - SHOW → `/shows/[id]`
  - FESTIVAL → `/festivals/[id]`
- **이벤트 바 hover**: 위 명시된 색상 전환 + cursor:pointer
- **셀 호버**: 현재는 아무 액션 없음 (필요 시 추가 — 미정 사항)
- **`+N건 더보기` 클릭**: 그날의 풀 이벤트 리스트 팝오버 또는 `/calendar/day/[date]` 진입 (어느 쪽으로 갈지 결정 필요)
- **모바일**: 같은 페이지 내 수직 리스트 fallback — 이 핸드오프 범위 밖

---

## State Management

- **`month: Date`** — 현재 보고 있는 달. URL `?month=YYYY-MM`에서 hydrate.
- **`events: Event[]`** — 서버에서 fetch한 이벤트 (현재 표시 월 ± 1달 정도까지)
- 클라이언트 계산:
  - `eventBlocks(event)` — 세션을 연속/비연속 블록으로 그룹
  - `monthCells(month)` — 일요일 시작 42(또는 35)셀 배열
  - `blockInWeek(block, weekStart)` — 주 경계로 자르기
  - `assignLanes(weekBlocks)` — Greedy lane 할당

Server component에서 이번 달 이벤트를 fetch한 뒤 client component로 grid 렌더.

---

## Design Tokens (전체는 `DESIGN_SYSTEM.md` 참조)

이 페이지에서 사용한 토큰만 추림:

**Colors**
| Token | Value | 용도 |
|---|---|---|
| `ink-900` | `#0a0a0a` | 페이지 배경 |
| `paper` | `#fafafa` | 본문, 활성 텍스트 |
| `paper/90` | rgba 0.9 | 주말 날짜 |
| `paper/70` | rgba 0.7 | 평일 날짜 |
| `paper/55` | rgba 0.55 | DOW 헤더, 부제 텍스트 |
| `paper/45` | rgba 0.45 | 키커, 컨트롤 라벨, legend |
| `paper/40` | rgba 0.4 | summary 셀 라벨 |
| `paper/35` | rgba 0.35 | DOW 평일 |
| `paper/30` | rgba 0.3 | 과거 날짜, "1월" 라벨 |
| `lime` | `#d4ff4d` | **오늘 dot 전용** |
| hairline | `rgba(255,255,255,0.06)` | 모든 1px 선 |
| white/[0.08], white/[0.14] | — | SHOW 바 base / hover |
| paper/40, paper/80 | — | FEST 바 border base / hover |

**Spacing & Sizes**
- 컨테이너 max-width: `1320px`, `px-10`
- 헤더 높이: 72px (HomeHeader)
- 백링크 영역 ~ MonthNav 사이 마진: 32px (`mt-8`)
- 캘린더 셀 최소 높이: **132px**
- 캘린더 셀 패딩: `10px 12px 8px`
- 이벤트 바: 높이 **22px**, lane gap **4px**, 셀 상단 오프셋 **26px**, 좌우 마진 6px
- 최대 표시 lane: **3** (4번째부터 overflow)

**Typography**
- 본문: `Pretendard Variable`
- 디스플레이 (월 타이틀, summary 숫자): `Big Shoulders Display` weight 900
- 키커: 10–11px, `tracking-[0.18em]` 또는 `[0.3em]`, uppercase
- 이벤트 바 텍스트: 11px font-medium, 보조 라벨 9px tracking-[0.12em]
- 날짜 숫자: 13px tabular-nums tracking-tight

**Border radius**
- 이벤트 바: 3px (양쪽), 주 경계에서 잘리면 해당 쪽 0
- 그 외: hairline 위주, 둥근 모서리 거의 없음 (rounded-3xl 금지)

---

## 새로 만들 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `CalendarPage` | `app/calendar/page.tsx` | 진입점. URL `?month=` 파싱, 서버에서 이벤트 fetch |
| `MonthNav` | `components/calendar/MonthNav.tsx` | 타이틀 + 컨트롤 row |
| `SummaryStrip` | `components/calendar/SummaryStrip.tsx` | 4셀 요약 strip |
| `MonthGrid` | `components/calendar/MonthGrid.tsx` | 7×N 그리드 + 이벤트 바 렌더 |
| `EventBar` | `components/calendar/EventBar.tsx` | 한 줄 이벤트 바 (SHOW/FEST 분기) |
| `CalendarLegend` | `components/calendar/CalendarLegend.tsx` | 하단 legend |

### 유틸 (`lib/calendar.ts`)
다음 순수 함수를 별도 모듈로 추출:
- `monthCells(month: Date): Date[]`
- `eventBlocks(event: Event): EventBlock[]`
- `blockInWeek(block, weekStart): WeekSeg | null`
- `assignLanes(weekBlocks): WeekBlock[]`

테스트하기 쉽도록 모두 pure function. `calendar-app.jsx` 안에 동일 시그니처로 구현되어 있으니 그대로 가져다 쓰면 됨.

---

## Edge cases / 확인 필요 (미정 사항)

| # | 항목 | 시안 기본값 | 결정 필요 |
|---|---|---|---|
| 1 | 셀에 시각·가격 노출 | 안 함 (이름만) | 노출할지 |
| 2 | 도시·지역 필터 칩 | 없음 | 캘린더 상단에 둘지 |
| 3 | 월 이동 범위 | prev/next 무제한 | 분기 jump만 vs 무제한 |
| 4 | `+N건 더보기` 동작 | placeholder | 팝오버 vs 새 페이지 |
| 5 | 빈 달 (이벤트 0건) | 빈 grid 그대로 | 빈 상태 메시지 추가? |
| 6 | 모바일 뷰 | 핸드오프 범위 밖 | 별도 시안 필요 |
| 7 | 셀 호버 시 동작 | 없음 | 그날 미리보기 띄울지 |

---

## Files in this Handoff

| 파일 | 설명 |
|---|---|
| `README.md` | 이 파일 |
| `DESIGN_SYSTEM.md` | **반드시 먼저 읽기** |
| `Headliner Calendar.html` | 캘린더 페이지 진입점 |
| `calendar-app.jsx` | 캘린더 컴포넌트 + 유틸 + mock 데이터 |
| `icons/` | favicon 세트 |
