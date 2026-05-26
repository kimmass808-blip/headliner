# Handoff: Headliner — Artist Detail (`/artists/[id]`)

## Overview
아티스트 상세 페이지 디자인 핸드오프. 검색 결과 row 클릭 또는 공연 상세의 ARTIST 라인 클릭으로 도달.
**작업 전 반드시 `DESIGN_SYSTEM.md`를 먼저 읽으세요.**

## About the Design Files
이 폴더의 HTML은 **디자인 레퍼런스**입니다 — 의도된 룩·동작을 보여주는 프로토타입이지, 그대로 복사할 프로덕션 코드가 아닙니다.

- 시안 안의 `<HeaderPlaceholder />`, `<BackLinkPlaceholder />`, `<PosterCardPlaceholder />`는 **이미 구현된 컴포넌트의 위치 표시**입니다. 새로 만들지 말고 코드베이스의 기존 `<HomeHeader />`, `<BackLink />`, `<PosterCard />`를 그대로 import하세요.
- 시안 상단의 토글(`전체 / BIO 없음 / 공연 없음 / 최소`)은 **시안 미리보기용**입니다. 프로덕션에 들어가지 않습니다.

## Fidelity
**High-fidelity.** 색·간격·타이포·인터랙션 모두 의도된 최종 값.

---

## Data Model

```ts
type Artist = {
  id: string;
  canonicalName: string;        // "실리카겔"
  aliases?: string[];           // ["Silica Gel", "SILICA GEL"]
  photo?: string;               // 정사각 비율 권장
  links?: ArtistLink[];
  upcoming?: Show[];            // date >= today
  past?: Show[];                // date < today
};

type ArtistLink = {
  kind: 'instagram' | 'website' | 'youtube' | 'spotify' | 'bandcamp' | 'twitter';
  label: string;                // "@silicagel.official" 등 — aria-label/title용
  url: string;
};
```

---

## Layout

1. `<HomeHeader />` (재사용)
2. `<BackLink />` (재사용) — "← 검색으로"
3. **HeroSection** — `grid-cols-[280px,1fr]` (sm `[180px,1fr]`, 모바일 `[112px,1fr]`)
   - 좌: **ArtistPortrait** — 정사각 비율, `rounded-md`, `object-cover`. 사진 없으면 점선 박스(`NO PHOTO` 라벨)
   - 우:
     - `ARTIST` 키커
     - 큰 이름 헤드라인 (Pretendard 700, lg 72px / sm 56px / mobile 32px, letter-spacing -0.035em)
     - aliases — 있으면 `Silica Gel · SILICA GEL` 형식 (paper/55, 14px)
     - 외부 링크 — **40×40 원형 아이콘 버튼** 행
4. **ShowsGrid "UPCOMING / 2026"** — `<PosterCard />` 그리드 (1/2/4 컬럼 반응형)
5. **ShowsGrid "ARCHIVE"** — 동일 구조, 다른 kicker
6. 다가오는/지난 둘 다 없으면 **NoShowsState** 점선 박스

---

## 결정 사항

| 결정 | 값 | 이유 |
|---|---|---|
| 프로필 사진 비율 | **정사각** | 원형은 검색 결과 row에서 이미 사용. 차별화로 매거진 무드 유지. 디자인 시스템 카드 라디우스(`rounded-md`)와 통일 |
| BIO 섹션 | **없음** | 현 시안 기준 제거. 추후 추가하려면 헤로 아래 별도 섹션(`max-w-3xl`)에 단단 텍스트로 |
| aliases 라벨 | **AKA 텍스트 제거** | `Silica Gel · SILICA GEL` 형식만 표시 |
| 외부 링크 표시 | **아이콘 버튼** | 40×40 원형, border-soft. 헤더 검색 버튼과 동일 스타일. 텍스트 라벨은 `aria-label`/`title` 툴팁으로 |
| 모바일 헤로 | **가로 컴팩트** | 사진 112px + 우측 정보. 세로 적층은 스크롤 길이 증가 |

---

## 새로 만들 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `ArtistPortrait` | `components/artist/ArtistPortrait.tsx` | 정사각, 사진 없으면 점선 박스 |
| `HeroSection` | `components/artist/HeroSection.tsx` | 좌 사진 + 우 정보 그리드 |
| `ExternalLinks` | `components/common/ExternalLinks.tsx` | 아이콘 버튼 행. **Show 상세 페이지의 TICKET/SOURCE도 이걸로 통합 가능** |
| `PlatformIcon` | `components/common/PlatformIcon.tsx` | kind에 따라 알맞은 SVG icon 반환 (Instagram / Website / YouTube / Spotify / 기타) |
| `ShowsGrid` | `components/common/ShowsGrid.tsx` | 섹션 헤딩(kicker + title + count) + PosterCard 4컬럼. **검색 결과와 공유 컴포넌트로 통합 권장** |
| `NoShowsState` | `components/common/NoShowsState.tsx` | 점선 박스 "등록된 공연 정보가 없습니다" |

> `ShowsGrid`, `NoShowsState`는 검색 결과 페이지에서 같은 패턴이 이미 쓰이고 있으므로, 가능하면 공통 컴포넌트로 통합하세요.

---

## Behavior

- aliases 빈 배열이거나 null → 미렌더
- links 빈 배열이거나 null → ExternalLinks 미렌더
- upcoming/past 둘 다 비어있으면 → 두 ShowsGrid 대신 NoShowsState 하나만 렌더
- 외부 링크는 모두 `target="_blank" rel="noreferrer"`
- 호버 시 border와 아이콘 색이 또렷해짐(`border-white/10` → `border-white/30`, `text-paper/70` → `text-paper`)
- 프로필 사진은 정적 (호버 효과 없음)

---

## Files

| 파일 | 설명 |
|---|---|
| `README.md` | 이 파일 |
| `DESIGN_SYSTEM.md` | **반드시 먼저 읽기** |
| `Headliner Artist.html` | 시안 진입점 |
| `artist-detail-app.jsx` | 컴포넌트 구현 (mock 데이터 인라인) |
