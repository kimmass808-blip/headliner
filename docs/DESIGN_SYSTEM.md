# Headliner — Design System

> 국내 인디 공연·페스티벌 검색·아카이브 웹사이트의 단일 디자인 진실 공급원(single source of truth).
> 새 페이지·컴포넌트를 만들 때 **반드시 이 문서를 먼저 참조**할 것.

## 0. 사용법 (AI / Claude Code 용)

새 페이지를 만들거나 디자인 결정이 필요할 때:
1. 이 파일을 먼저 읽고 토큰을 사용하세요
2. 이 문서에 없는 새 컬러/폰트/패턴이 필요하면, 먼저 사용자에게 확인 후 이 문서에 추가
3. 의심스러우면 절대 새 토큰을 만들지 말고 기존 것을 재사용

---

## 1. 브랜드 정체성

- **이름**: Headliner
- **한 줄 설명**: 국내 인디 음악 씬의 공연·페스티벌·아티스트를 검색·아카이브하는 곳
- **사용자**: 익명, 가입 없음, 검색 중심
- **무드**: 따뜻한 다크 / 에디토리얼 아카이브 / 인디 록 잡지의 디지털 버전
- **레퍼런스**: Spotify 홈 + Apple Music 타이포 + Bandcamp 색감
- **운영 원칙**: 가입 없이, 광고 없이, 정직한 인덱스

### 톤
- **카피**: 차분하고 짧게. 마케팅 문구 X. 사실 진술.
- **이모지**: 사용 X
- **불릿/장식**: 최소화. 정보가 충분하면 장식은 빼기.

---

## 2. 컬러 토큰

### 다크 무드 (기본)
```
ink/900   #0a0a0a  ← 페이지 배경
ink/850   #101010  ← 인풋·낮은 카드 배경
ink/800   #141414  ← 카드·스카프 배경 (한 단계 밝음)
ink/700   #1c1c1c  ← 카드 fallback / 비활성
ink/600   #262626
ink/500   #3a3a3a

paper     #fafafa  ← 메인 텍스트, "화이트"
muted     #8a8a8a  ← 보조 텍스트
dim       #5a5a5a  ← 플레이스홀더, 비활성
```

### 라인·테두리
```
hairline       rgba(255,255,255,0.06)   ← 헤더/섹션 구분선
border-soft    rgba(255,255,255,0.10)   ← 인풋·칩 기본
border-hover   rgba(255,255,255,0.25)
border-strong  rgba(255,255,255,0.80)
```

### 액센트 (옵션 — 기본은 모노크롬)
운영 결정: **기본은 액센트 없는 모노크롬.** 페스티벌 시즌·캠페인용으로만 한시적으로 액센트를 켤 수 있음.

| 옵션 | HEX | 캐릭터 |
|---|---|---|
| Lime (선호) | `#d4ff4d` | 발랄, 인디 팝 |
| Hot Pink | `#ff3d8a` | 슈게이즈·K-인디 |
| Cyan | `#4dd6ff` | 일렉트로닉·모던 |
| Sunset | `#ff7a3d` | 페스티벌·여름 |
| Cream | `#f5e96b` | 빈티지·프린트 |

액센트를 쓰지 않을 때는 **위치만 유지**하고 색만 `#fafafa`로 대체 (예: 페스티벌 뱃지는 채움 대신 아웃라인).

### 다크 오버레이 (이미지 스크림)
```
hero scrim 1   bg-gradient-to-tr from-black/85 via-black/40 to-black/10
hero scrim 2   bg-gradient-to-t  from-black/70 via-transparent to-transparent
card bottom    bg-gradient-to-t  from-black/80 via-black/20 to-transparent  (포스터 하단)
```

---

## 3. 타이포그래피

### 패밀리
| 역할 | 폰트 | 용도 |
|---|---|---|
| `sans` (기본) | **Pretendard Variable** → Pretendard → system-ui | 모든 본문, 헤드라인, UI |
| `display` | **Big Shoulders Display** (Weight 900만) | 로고 wordmark, 포스터 카드의 날짜 숫자 |

> 한국어가 영문 못지않게 잘 어울리는 것이 1순위. 한국어는 항상 Pretendard.
> 영문 디스플레이는 Big Shoulders로만 한정 (지나친 폰트 다양성 금지).

### 스케일

#### 헤드라인 (Pretendard)
| 토큰 | 크기 (lg / sm / mobile) | weight | letter-spacing | line-height | 용도 |
|---|---|---|---|---|---|
| `hero/L` | 120 / 88 / 14vw | 800 | -0.035em | 0.92 | 풀 사이즈 히어로 (이미지 없을 때) |
| `hero/M` | 104 / 76 / 12vw | 800 | -0.035em | 0.92 | 기본 히어로 |
| `hero/S` | 80 / 60 / 10vw | 800 | -0.035em | 1.0 | 이미지 위 오버레이 히어로 ← 현재 사용 |
| `section/L` | 40 / 32 / — | 700 | -0.025em | 1.1 | "다가오는 공연" 같은 섹션 |
| `card/title` | 17 | 600 | -0.01em | 1.2 | 카드 아티스트명 |

#### 본문·UI (Pretendard)
| 토큰 | 크기 | weight | letter-spacing | 용도 |
|---|---|---|---|---|
| `body` | 15 | 400 | 0 | 설명 |
| `ui` | 13 | 600 | 0.02em | 헤더 nav, 버튼 |
| `meta` | 13 | 400 | 0 | 카드 부제 |
| `caption` | 11 | 400 | 0.08em | 카드 venue 라인 |

#### 라벨 (모노 / Uppercase)
모든 라벨류는 **Pretendard 500**, uppercase, 큰 letter-spacing.
| 토큰 | 크기 | letter-spacing | 용도 |
|---|---|---|---|
| `kicker/L` | 12 | 0.3em | 섹션 위 라벨 ("NOW PLAYING") |
| `kicker/S` | 11 | 0.3em | 섹션 헤딩 위 작은 라벨 ("UPCOMING / 2026") |
| `badge` | 10 | 0.22em | 카드 type/day 뱃지 |
| `tab` | 12 | 0.18em | "전체 보기" 같은 링크 |

#### 디스플레이 (Big Shoulders 900)
| 토큰 | 크기 | letter-spacing | 용도 |
|---|---|---|---|
| `logo` | 28~32 | 0.005em | 헤더 로고 |
| `card-date` | 28~30 | 0 | 카드 좌하단 `MM/DD` |

### 폰트 로딩
```ts
// app/layout.tsx
import localFont from 'next/font/local'         // Pretendard Variable
import { Big_Shoulders_Display } from 'next/font/google'
```
프로토타입의 CDN 로딩(`cdn.jsdelivr.net/gh/orioncactus/pretendard`)은 프로덕션에서 셀프호스팅으로 교체.

---

## 4. 스페이싱·레이아웃

### 컨테이너
- **max-width**: `1400px`
- **가로 패딩**: `24px (mobile)` → `40px (sm+)`
- **헤더 높이**: `72px`

### 섹션 간격
```
header → hero          0       (헤더 바로 아래 히어로 시작)
hero → search          40~48
search → grid section  60
section heading → grid 40
```

### 그리드
- **포스터 카드 그리드**: `gap-x-24px gap-y-48px` — 가로보다 세로 간격이 넉넉해야 카드 메타가 숨쉴 공간 확보
- **컬럼**: mobile 1 / sm 2 / lg 4

### Radius
```
rounded-sm    2px    ← 작은 뱃지
rounded-md    6px    ← 카드 포스터
rounded-lg    8px    ← 히어로 블럭, 큰 카드
rounded-full  ∞      ← 검색 인풋, 칩, 원형 버튼
```

### Aspect Ratios
- **포스터 카드**: `3:4`
- **히어로 블럭**: mobile `16:10` → sm `16:9` → lg `21:9` (min 420, max 720)
- **아티스트 썸네일**: (TBD — 1:1 권장)

---

## 5. 인터랙션·모션

### 전역 transition 가이드
| 속성 | duration | easing |
|---|---|---|
| 색·배경·border | 150~250ms | ease |
| transform (이미지 hover) | 600ms | `cubic-bezier(.2,.7,.2,1)` |
| arrow/icon nudge | 200ms | ease-out |

### Hover 패턴
- **텍스트 링크**: 70% → 100% opacity (`text-paper/70` → `text-paper`)
- **테두리**: 10% → 30% opacity
- **카드 포스터**: `scale(1.03)` + `brightness(1.05)` + opacity `0.9` → `1.0`
- **아이콘 + 라벨 링크**: 아이콘만 `translate-x-1` 만큼 미세 이동 ("전체 보기 →")

### Focus 패턴
- **인풋**: border `#fafafa`, bg 한 단계 밝아짐 (`ink/850` → `ink/800`), caret `#fafafa` (액센트 사용시 액센트 색)

---

## 6. 컴포넌트 패턴

새 페이지에서 같은 종류의 UI를 만들 때 **반드시 같은 사양을 따를 것.**

### Header
- height 72px, 하단 hairline
- 좌: 로고 (`logo` 토큰)
- 중: nav (md+에서만, `ui` 토큰, color `paper/70` → hover `paper`, gap 32px)
- 우: 검색 아이콘 버튼 (원형 36×36, border-soft)

### Search Bar (Pill)
- max-w-3xl, 중앙 정렬
- height 64 (mobile) / 72 (sm+)
- bg `ink/850`, border-soft → hover border-hover → focus `paper` + bg `ink/800`
- 좌측: search icon 20×20 (`paper/50` → focus `paper`)
- 중앙: input (`body` 토큰, placeholder `dim`)
- 우측 (sm+): "검색" CTA. bg `paper`, color `ink/900`, 44px height, `rounded-full`, `ui` 토큰

### Filter Chips
- 컨테이너: flex wrap, gap 8, justify-center
- chip: height 32, padding-x 14, `rounded-full`, border-soft, 12px text, color `paper/70`
- active chip: bg `paper`, color `ink/900`, border `paper`
- 점선 chip (커스텀 추가용): border-dashed `rgba(255,255,255,0.1)`, color `dim`

### Section Heading
구조: kicker (`kicker/S`) + 큰 제목 (`section/L`) + (선택) 우측 "전체 보기" 링크 + hairline 하단 구분선

### Poster Card
- 포스터 (3:4, `rounded-md`)
  - 이미지 + hover 모션 (위 인터랙션 참고)
  - 하단 그라디언트 스크림
  - 좌상: type badge (`badge` 토큰)
    - SHOW: bg `rgba(255,255,255,0.1)` + backdrop-blur
    - FESTIVAL: border 1px `paper/80`, bg `rgba(0,0,0,0.3)` + backdrop-blur, weight 600
  - 우상: day badge (`badge`, bg `rgba(0,0,0,0.4)` + backdrop-blur)
  - 좌하: `MM/DD` (`card-date` 토큰, slash는 `paper/60`)
- 메타 (포스터 아래, mt-16)
  - artist `card/title`
  - title `meta`, `paper/55`, line-clamp-1, mt-4
  - venue 라인 `caption`, `paper/45`, mt-12, 형식 `{도시} · {장소}`

### Hero (이미지 배경)
- 풀폭 라운드 블럭, 위 aspect ratio
- 이미지 `object-cover`, `object-position: 50% 38%` (얼굴·기타 등 포커스가 가운데 위로 오게)
- 2겹 스크림 (위 컬러 토큰의 hero scrim 1+2)
- 좌하단 헤드라인 (`hero/S` 두 줄)

### 아이콘
- **현재 인라인 SVG** 사용 (검색, 화살표). lucide 스타일의 가는 stroke (1.6).
- 새 아이콘이 필요하면 `lucide-react` 도입 권장 (Next 환경).

---

## 7. 콘텐츠 타입

### Show (단독 공연)
- 필드: `artist`, `title`, `venue`, `city`, `date` (YYYY.MM.DD), `day` (요일 또는 "N DAYS"), `poster`
- 카드 type 뱃지: `SHOW`

### Festival
- 필드: Show와 동일 + 라인업 리스트
- 카드 type 뱃지: `FESTIVAL` (아웃라인 강조)

### Artist
- 필드: `name`, `genre`, `thumbnail`, `upcomingShows[]`, `pastShows[]`
- (페이지 시안 미정)

---

## 8. 반응형 브레이크포인트

Tailwind 기본 사용:
| breakpoint | min-width | 주요 변화 |
|---|---|---|
| `mobile` | 0 | 그리드 1열, nav 숨김, 검색 CTA 숨김, 히어로 16:10 |
| `sm` | 640px | 그리드 2열, 검색 CTA 표시, 히어로 16:9 |
| `md` | 768px | nav 표시 |
| `lg` | 1024px | 그리드 4열, 히어로 21:9 |
| `xl` | 1280px | (변화 없음) |

---

## 9. 의도적으로 하지 않는 것

이 결정들은 디자인의 정체성을 유지하기 위해 **고의로** 피하고 있음:

- ❌ 카드/버튼 그라디언트 배경 (단색 또는 이미지)
- ❌ 글로우·네온 효과
- ❌ 좌측 보더 액센트 (`border-l-4 border-lime`) — 빈티지 블로그 UI 트로프
- ❌ 이모지
- ❌ Inter, Roboto, Arial 등 흔한 폰트
- ❌ 큰 둥근 모서리(`rounded-3xl`) — 6~8px가 우리 라디우스 한계
- ❌ 풀 가로 그라디언트 히어로 배경

---

## 10. 변경 이력

- **2026-05-26** v0.1 — 홈 페이지 시안 기반 초안. 다크 모노크롬 결정.
