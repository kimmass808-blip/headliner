# Handoff: Headliner — Search Results & Show Detail

## Overview
홈 페이지에 이어 검색 결과 페이지(`/?q=...`)와 단독공연 상세 페이지(`/shows/[id]`) 두 화면의 디자인 핸드오프입니다.
**작업 전에 반드시 `DESIGN_SYSTEM.md`를 먼저 읽으세요.** 두 페이지 모두 그 토큰·컴포넌트 패턴을 따릅니다.

## About the Design Files
이 폴더의 HTML 파일은 **디자인 레퍼런스**입니다 — 의도된 룩과 동작을 보여주는 프로토타입이지, 그대로 복사해 넣을 프로덕션 코드가 아닙니다.
타겟 코드베이스(Next.js 15 + Tailwind CSS) 환경에서 같은 디자인을 재현하는 것이 목표입니다.

특히:
- 프로토타입은 React + Babel을 CDN으로 로드하지만, 프로덕션은 **Next.js App Router**로 구현
- 시안 안의 `<HeaderPlaceholder />`, `<SearchBarPlaceholder />`, `<PosterCardPlaceholder />`는 **이미 구현된 컴포넌트의 위치 표시**입니다. 새로 만들지 말고 코드베이스의 기존 `<HomeHeader />`, `<HomeSearchBar />`, `<PosterCard />`를 그대로 import하세요.
- 시안 상단의 토글 버튼(`✓ 결과 있음 / 빈 상태`, `단독 공연 / 페스티벌 소속 / 셋리스트 미등록`)은 **시안 미리보기용**입니다. 프로덕션에 들어가지 않습니다.

## Fidelity
**High-fidelity.** 색상·간격·타이포·인터랙션 모두 의도된 최종 값입니다.

---

## Page 1 — Search Results (`/?q=...`)

### Purpose
홈 검색바에서 Enter 누르면 도달. URL의 `q` 파라미터를 읽어 결과를 표시. 결과는 세 종류가 섞임:
- **Show**: 단독공연 → `<PosterCard type="SHOW" />`
- **Festival**: 페스티벌 → `<PosterCard type="FESTIVAL" />`
- **Artist**: 아티스트 → 가로 row (이 페이지가 새로 정의하는 컴포넌트)

### Layout
1. `<HomeHeader />` (재사용)
2. `<HomeSearchBar initialQuery={q} />` (재사용) — 페이지 상단 중앙
3. **ResultsBar** — 검색어 헤드라인 + 카운트 필터 탭(전체/아티스트/공연/페스티벌) + 정렬 옵션
4. **ArtistSection** — 가로 row 리스트 (필터가 `all` 또는 `artist`일 때만)
5. **PosterGrid** "다가오는 공연" — 4컬럼 PosterCard 그리드
6. **PosterGrid** "지난 공연" — 동일, 키커만 `ARCHIVE`

### 새로 만들 컴포넌트
| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `ResultsBar` | `components/search/ResultsBar.tsx` | 헤드라인 + 필터 탭(카운트 포함) + 정렬 옵션 |
| `ArtistRow` | `components/search/ArtistRow.tsx` | 검색 결과의 아티스트 가로 row. 아바타(72×72 원형) + 이름 + aliases + arrow |
| `ArtistSection` | `components/search/ArtistSection.tsx` | ArtistRow 목록 + 섹션 헤딩 |
| `EmptyState` | `components/search/EmptyState.tsx` | 결과 없을 때. 큰 옅은 `0` + 안내문 + 자주 찾는 검색어 chip + 보조 CTA |

### Behavior
- URL의 `q`가 비어있으면 → 홈 페이지 렌더 (검색 결과 페이지 진입 X)
- `q`가 있고 결과가 있으면 → ResultsBar + 결과 섹션들
- `q`가 있고 결과가 없으면 → `EmptyState`
- 필터 탭 클릭 시 클라이언트 사이드로 결과 필터링 (URL 변경 X) 또는 `?q=...&type=show` 같은 쿼리 파라미터 추가 (택1)
- ArtistRow 클릭 → `/artists/[id]` 라우팅

### Files
- `Headliner Search.html` — 진입점
- `search-results-data.js` — mock 데이터 (실제 API 응답으로 교체)
- `search-results-app.jsx` — 컴포넌트 구현

---

## Page 2 — Show Detail (`/shows/[id]`)

### Purpose
검색 결과 또는 카드 그리드의 SHOW 카드 클릭 시 도달. 단일 공연의 모든 정보를 표시.

### 데이터 모델
```ts
type Show = {
  artists: string[];           // 1~N명
  title: string;               // "LIQUID SUNSHINE TOUR"
  date: string;                // "2026.06.14"
  day: string;                 // "SAT"
  dayKr: string;               // "토요일"
  time?: string;               // "19:00" — null 가능
  venue: string;
  city?: string;
  festival?: {                 // null이면 단독공연
    name: string;
    stage?: string;
    id: string;
  };
  poster: string;
  ticket?: string;
  ticketLabel?: string;
  source?: string;             // 인스타그램 등 원문 URL
  sourceLabel?: string;
  missing?: string[];          // ['time', 'venue'] 등 누락 필드
  setlist?: Song[];
};

type Song = {
  n: number;                   // 곡 번호 (앙코르는 1부터 다시 시작)
  title: string;
  cover?: string;              // 원작자 (e.g., "Wham!")
  encore?: boolean;
};
```

### Layout
1. `<HomeHeader />` (재사용)
2. **BackLink** — "← 검색으로". `router.back()` 또는 `<Link href="/">`
3. **메인 영역** — `lg:grid-cols-[minmax(0,520px),1fr]` 2컬럼
   - **PosterColumn (좌)**: 70vh max-h, `object-contain`으로 원본 비율 보존
   - **InfoColumn (우)**: 페스티벌 배너 → 날짜 키커 → 아티스트명 헤드라인 → 공연 타이틀 → 메타 dl → 누락 뱃지
4. **SetlistSection** — 본편 ol + 앙코르 디바이더 + 앙코르 ol. 셋리스트 없을 때 점선 박스로 "미등록" 상태

### 새로 만들 컴포넌트
| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `BackLink` | `components/common/BackLink.tsx` | 라우터 back + uppercase 라벨 |
| `FestivalBanner` | `components/show/FestivalBanner.tsx` | 페스티벌 소속 표시. ext arrow + hover underline |
| `MissingFieldsBadge` | `components/show/MissingFieldsBadge.tsx` | 점선 outline pill |
| `MetaRow` | `components/common/MetaRow.tsx` | label/value 2컬럼 dl row. **다른 상세 페이지에서도 재사용** |
| `InfoColumn` | `components/show/InfoColumn.tsx` | 오른쪽 컬럼 전체 |
| `PosterColumn` | `components/show/PosterColumn.tsx` | 왼쪽 포스터 + 캡션 |
| `SetlistSection` | `components/show/SetlistSection.tsx` | 본편/앙코르 분리 + 빈 상태 |
| `SongRow` | `components/show/SongRow.tsx` | 셋리스트의 한 줄 (번호 + 제목 + 옵션 뱃지) |

### Behavior
- `festival`이 null이면 FestivalBanner 미렌더
- `setlist`가 빈 배열이면 "셋리스트 미등록" 점선 박스
- `missing` 배열이 비어있으면 MissingFieldsBadge 미렌더
- 외부 링크는 모두 `target="_blank" rel="noreferrer"`, hover시 `↗` 아이콘이 우상단으로 미세 이동

### Files
- `Headliner Show.html` — 진입점
- `show-detail-app.jsx` — 컴포넌트 구현 (mock 데이터 인라인)

---

## 공통 디자인 토큰 사용
두 페이지 모두 `DESIGN_SYSTEM.md`의 토큰만 사용했고, 새 컬러·폰트·라디우스를 추가하지 않았습니다.

새 컴포넌트가 디자인 시스템 토큰으로 표현되지 않는 패턴을 만든 경우(있을 시 사용자 확인 후) `DESIGN_SYSTEM.md`에 추가하세요. 예시로 가능한 후보:
- `MetaRow` 패턴 (label 110px / value 가변, hairline row) — 디자인 시스템의 컴포넌트 섹션에 추가 권장
- "ext" 외부 링크 패턴 (텍스트 + `↗`) — 컴포넌트 섹션에 추가 권장
- 셋리스트 ol/li 패턴 — Festival 라인업·타임테이블에도 응용 가능하니 추후 추출

## 구현 권장 단계

1. **컴포넌트 분리**
   ```
   components/
     common/
       BackLink.tsx
       MetaRow.tsx
       Icons.tsx                // ArrowLeft, ArrowUpRight, SearchIcon
     search/
       ResultsBar.tsx
       ArtistRow.tsx
       ArtistSection.tsx
       EmptyState.tsx
     show/
       FestivalBanner.tsx
       MissingFieldsBadge.tsx
       InfoColumn.tsx
       PosterColumn.tsx
       SetlistSection.tsx
       SongRow.tsx
   ```
2. **검색 결과 라우트**:
   `app/page.tsx`에서 `searchParams.q` 확인 → 있으면 SearchResults 컴포넌트, 없으면 Home 렌더
3. **공연 상세 라우트**:
   `app/shows/[id]/page.tsx` — 서버 컴포넌트로 데이터 fetch
4. **포스터 이미지**:
   `next/image` 사용. 상세 페이지 포스터는 `priority` 지정

## Files in this Handoff

| 파일 | 설명 |
|---|---|
| `README.md` | 이 파일 |
| `DESIGN_SYSTEM.md` | **반드시 먼저 읽기** — 컬러·타이포·간격 토큰, 컴포넌트 패턴, "안 하는 것" 가드레일 |
| `Headliner Search.html` | 검색 결과 페이지 시안 진입점 |
| `search-results-app.jsx` | 검색 결과 컴포넌트 구현 |
| `search-results-data.js` | mock 데이터 |
| `Headliner Show.html` | Show 상세 페이지 시안 진입점 |
| `show-detail-app.jsx` | Show 상세 컴포넌트 구현 (mock 인라인) |
| `icons/` | favicon 세트 (이미 홈 핸드오프에서 받았다면 중복) |
