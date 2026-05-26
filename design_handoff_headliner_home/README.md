# Handoff: Headliner — Home Page (Dark)

## Overview
홈 페이지 디자인 핸드오프. Headliner는 국내 인디 음악 씬의 공연·페스티벌·아티스트 정보 검색·아카이브 웹사이트입니다. 이 패키지는 다크 무드 홈 페이지의 hi-fi 시안을 담고 있습니다.

## About the Design Files
이 폴더의 HTML 파일은 **디자인 레퍼런스**입니다 — 의도된 룩과 동작을 보여주는 프로토타입이지, 그대로 복사해 넣을 프로덕션 코드가 아닙니다. 작업의 목표는 **이 HTML 디자인을 타겟 코드베이스(Next.js 15 + Tailwind CSS) 환경에서 재현하는 것**입니다. 코드베이스의 기존 컴포넌트 구조, 폴더 관습, Tailwind config을 따르세요.

특히:
- 프로토타입은 React + Babel을 CDN으로 로드하지만, 프로덕션은 **Next.js App Router의 React Server / Client Components**로 구현
- `tailwind.config.js`에 한 번에 컬러 토큰을 등록하고, 인라인 `tailwind.config = {}` 블럭은 그대로 쓰지 마세요
- 컴포넌트는 `app/(home)/page.tsx` 또는 적절한 라우트 + `components/home/` 하위로 분리 권장

## Fidelity
**High-fidelity (hifi).** 색상·타이포·간격·인터랙션 모두 의도된 최종 값입니다. 코드베이스의 기존 디자인 토큰이 있다면 그쪽 우선, 없으면 아래 토큰을 그대로 사용하세요.

## Screens / Views

### Home (`/`)
홈 페이지 — 사이트 진입 후 첫 화면.

**Purpose:** 사용자는 분위기 있는 히어로 이미지로 사이트의 정체성을 인지하고, 검색바·필터칩으로 즉시 검색하거나, 카드 그리드에서 다가오는 공연을 탐색합니다.

**Layout (max-w 1400px, 가로 패딩 sm:40px / mobile:24px):**
1. **Header** (height 72px, full-bleed, 하단 hairline 1px rgba(255,255,255,0.06))
2. **Hero image block** — 라운드 컨테이너, 비율 16:10(mobile) → 16:9(sm) → 21:9(lg), min-height 420px, max-height 720px
3. **Search bar + filter chips** — max-w-3xl, 중앙 정렬, 히어로 아래 mt-40~48px
4. **"다가오는 공연" 섹션** — section heading + 4컬럼 포스터 그리드

### Components

#### 1. Header
- **Logo**: 좌측. 폰트 `Big Shoulders Display` Weight 900, font-size 28~32px, color `#fafafa`, letter-spacing 0.005em
- **Nav (md+)**: 가운데. "공연 / 페스티벌 / 아티스트 / 아카이브". Pretendard 600, 13px, color `rgba(250,250,250,0.7)`, hover `#fafafa`, gap 32px
- **Search icon button (우측)**: 원형 36×36, border 1px rgba(255,255,255,0.1), hover border-color rgba(255,255,255,0.3). 아이콘 16×16 lucide 스타일

#### 2. Hero Image Block
- **컨테이너**: `rounded-lg` (8px), `bg-#141414`, aspect-ratio 반응형(위 참고), `overflow:hidden`
- **이미지**: `object-cover`, `object-position: 50% 38%`
- **스크림(2겹)**:
  - `bg-gradient-to-tr from-black/85 via-black/40 to-black/10`
  - `bg-gradient-to-t from-black/70 via-transparent to-transparent`
- **헤드라인** (절대 위치, 좌하단 padding 20~40px):
  - 텍스트: **"당신의 심장이"** / **"뛰는 순간"** (두 줄)
  - 폰트: Pretendard Variable, Weight 800, letter-spacing -0.035em, line-height 1.0
  - Font-size (반응형, "S" 스케일 기준): `text-[8vw] sm:text-[42px] lg:text-[56px]`
  - 두 줄 사이 `margin-top: 2px`

#### 3. Search Bar
- **컨테이너**: max-w-3xl, 중앙 정렬 (mx-auto), pill shape `rounded-full`
- **인풋 박스**: height 64px(mobile) / 72px(sm+), bg `#101010`, border 1px rgba(255,255,255,0.1), hover rgba(255,255,255,0.25), focus border-color `#fafafa` + bg `#141414`
- **Search 아이콘**: 20×20, color rgba(250,250,250,0.5), focus 시 `#fafafa`
- **Input**: bg-transparent, Pretendard 400, 15~17px, color `#fafafa`, placeholder `#5a5a5a`
- **CTA 버튼 (sm+)**: "검색" + arrow. height 44px, padding-x 20px, `rounded-full`, bg `#fafafa`, color `#0a0a0a`, font-weight 600, font-size 13px, uppercase, letter-spacing 0.05em

#### 4. Filter Chips
- **컨테이너**: mt-20px, flex wrap, gap 8px, **justify-center**
- **기본 chip**: height 32px, padding-x 14px, `rounded-full`, border 1px rgba(255,255,255,0.12), color rgba(250,250,250,0.7), font-size 12px, hover border rgba(255,255,255,0.3) + color `#fafafa`
- **Active chip (예: '전체')**: bg `#fafafa`, color `#0a0a0a`, border `#fafafa`
- **점선 chip ("+ 직접 필터")**: border-dashed rgba(255,255,255,0.1), color `#5a5a5a`
- **칩 순서**: 전체 / 이번 주 / 이번 달 / 서울 / 부산·대구 / 페스티벌 / + 직접 필터

#### 5. Section Heading ("다가오는 공연")
- **컨테이너**: 4단 그리드 위, hairline 하단 1px rgba(255,255,255,0.06), padding-bottom 24px, margin-bottom 40px
- **Kicker**: "UPCOMING / 2026". Pretendard 500, 11px, letter-spacing 0.3em, uppercase, color rgba(250,250,250,0.45), margin-bottom 12px
- **Heading**: "다가오는 공연". Pretendard 700, 40px(sm+) / 32px(mobile), letter-spacing -0.025em
- **"전체 보기" 링크 (우측)**: 12px, letter-spacing 0.18em, uppercase, color rgba(250,250,250,0.7), arrow icon 16×16, hover color `#fafafa`(또는 액센트), arrow에 `translate-x-1` transition

#### 6. Poster Card
- **컨테이너**: anchor 태그, block, group 호버
- **포스터 영역**: aspect-ratio 3:4, `rounded-md` (6px), `overflow:hidden`, bg `#1c1c1c`
- **이미지**: object-cover, opacity 0.9 → hover 1.0, scale(1.03) on hover (transition 600ms cubic-bezier(.2,.7,.2,1)), filter brightness(1.05) on hover
- **하단 어두움**: 이미지 아래쪽 절반에 `bg-gradient-to-t from-black/80 via-black/20 to-transparent`
- **상단 좌측 type badge**:
  - SHOW: bg rgba(255,255,255,0.1) + backdrop-blur, color rgba(250,250,250,0.9)
  - FESTIVAL: border 1px rgba(250,250,250,0.8), color `#fafafa`, bg rgba(0,0,0,0.3) + backdrop-blur, font-weight 600
  - 텍스트: 10px, letter-spacing 0.22em, uppercase, padding 8/4, rounded-sm
- **상단 우측 day badge**: bg rgba(0,0,0,0.4) + backdrop-blur, color rgba(250,250,250,0.8), 10px, letter-spacing 0.22em, uppercase, padding 8/4, rounded-sm
- **하단 좌측 날짜**: Big Shoulders Display Weight 900, 28~30px, color `#fafafa`. 형식 `MM/DD` (예: `06/14`). 슬래시는 rgba(250,250,250,0.6)
- **메타 (포스터 아래, margin-top 16px)**:
  - Artist (h3): Pretendard 600, 17px, letter-spacing -0.01em, color `#fafafa`, hover → 액센트 (선택)
  - Title: Pretendard 400, 13px, color rgba(250,250,250,0.55), `line-clamp-1`, margin-top 4px
  - Venue 라인: margin-top 12px, 11px, color rgba(250,250,250,0.45), letter-spacing 0.08em. 형식: `{도시} · {장소}`, 가운뎃점은 `#5a5a5a`

## Interactions & Behavior

### Hover States
- **Header nav**: 색상이 70% → 100% 화이트로 (transition 약 150ms)
- **Search icon button**: border 10% → 30% 화이트
- **Search input**: 포커스 시 border 화이트, bg 한 단계 밝아짐
- **Filter chips**: border 12% → 30%, color 70% → 100%
- **Poster card**:
  - 이미지: scale(1.03) + brightness(1.05) — duration 600ms
  - Artist title: 화이트 → 액센트 컬러 (transition 250ms) — 디자인은 monochrome 기본이므로 화이트 유지 가능
- **"전체 보기" 링크**: arrow가 translate-x-1px로 미세 이동

### 반응형
- **Mobile (~640px 미만)**: 카드 그리드 1열, 헤더 nav 숨김, 헤더 검색 CTA 숨김, 히어로 비율 16:10
- **sm (640px+)**: 카드 그리드 2열, 검색 CTA 표시, 히어로 16:9
- **lg (1024px+)**: 카드 그리드 4열, 히어로 21:9

### 무한 스크롤 / 페이지네이션
이번 시안 범위 외 — 현재는 8개 mock만 표시. 실제 구현 시 backend의 페이지네이션 또는 무한 스크롤 어느 쪽이든 가능.

## State Management
- `searchQuery: string` — 검색 인풋 값. 디바운스 후 검색 결과 페이지(`/search?q=...`)로 라우팅 또는 인라인 결과 표시
- `selectedFilter: string` — 현재 선택된 필터 칩. 기본값 `"전체"`. 변경 시 카드 그리드 갱신
- 카드 클릭 → `/shows/[id]` 또는 `/festivals/[id]` 라우팅

## Design Tokens

### Colors
```ts
// 다크 무드 토큰
ink: {
  900: '#0a0a0a',  // 페이지 배경
  850: '#101010',  // 인풋 배경
  800: '#141414',  // 카드/스카프 배경
  700: '#1c1c1c',  // 카드 fallback
  600: '#262626',
  500: '#3a3a3a',
}
paper: '#fafafa'   // 메인 텍스트
muted: '#8a8a8a'   // 보조 텍스트
dim: '#5a5a5a'     // 비활성 / 플레이스홀더
// hairline
border: 'rgba(255, 255, 255, 0.06)' // 헤더/섹션 구분선
// accent (현재 시안은 monochrome 기본, 향후 캠페인용으로 사용 가능)
accent: '#d4ff4d'  // lime
// 대안: hot pink #ff3d8a, cyan #4dd6ff, sunset #ff7a3d, cream #f5e96b
```

### Typography
```ts
fontFamily: {
  sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
  display: ['"Big Shoulders Display"', '"Pretendard Variable"', 'sans-serif'],
}
```
- Pretendard Variable: 로컬 또는 `pretendard` npm 패키지 사용 권장 (CDN은 프로토타입용)
- Big Shoulders Display: Google Fonts, weight 900만 로드 (로고 + 카드 날짜)

### Spacing / Radius
- 헤더 height: 72px
- 컨테이너 max-w: 1400px, 가로 패딩 24~40px
- Hero radius: `rounded-lg` (8px)
- Card radius: `rounded-md` (6px)
- Pill / chip radius: `rounded-full`
- Section gap (히어로 ↔ 검색): 40~48px
- Section gap (검색 ↔ 카드): 60px
- Grid gap: `gap-x-24px gap-y-48px`

## Assets

이 핸드오프에 포함된 자산:

| 파일 | 용도 | 비고 |
|---|---|---|
| `assets/hero-stage.jpg` | 히어로 배경 이미지 | 2752×1536, JPEG 86%, ~560KB. AI 생성 이미지(Gemini), 워터마크 제거 처리 완료. 실제 운영 시 라이선스 확인된 사진으로 교체 권장 |
| `assets/headliner-logo-white-on-black.png` | 로고 시안 (검정 배경) | Big Shoulders Display 900 |
| `assets/headliner-logo-white-transparent.png` | 로고 시안 (투명 배경) | 다른 배경에 합성 가능 |

**카드 포스터 이미지**: 현재 시안은 Unsplash 이미지 placeholder를 사용. 프로덕션은 백엔드에서 받은 공식 포스터 이미지 URL로 대체.

## Files

| 파일 | 설명 |
|---|---|
| `Headliner Home.html` | 메인 디자인 — 단일 파일 React + Tailwind 프로토타입 |
| `Headliner Logo.html` | 로고 6개 시안 모음 (참고용) |

`Headliner Home.html`을 브라우저에서 열어 인터랙티브하게 확인하세요. 우측 상단 Tweaks 토글이 있다면 무시 — 프로덕션에 들어가지 않는 프로토타입 컨트롤입니다.

## 구현 권장 단계

1. **Tailwind config 확장**: 위 디자인 토큰을 `tailwind.config.ts`의 `theme.extend.colors` / `fontFamily`에 추가
2. **Font 로딩**: `app/layout.tsx`에서 `next/font/local`(Pretendard) + `next/font/google`(Big Shoulders Display) 로드
3. **컴포넌트 분리** (제안):
   - `components/home/Header.tsx`
   - `components/home/Hero.tsx`
   - `components/home/SearchBar.tsx`
   - `components/home/FilterChips.tsx`
   - `components/home/UpcomingSection.tsx`
   - `components/home/PosterCard.tsx`
4. **이미지 최적화**: 히어로 이미지를 `next/image`로 감싸고 `priority` 지정
5. **mock 데이터를 실제 API 연동으로 교체**: SHOWS 배열 → server component에서 fetch
