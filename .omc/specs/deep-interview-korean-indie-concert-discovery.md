# Deep Interview Spec: 국내 인디 공연·페스티벌 검색·아카이브 플랫폼

## Metadata
- Interview ID: di-2026-05-14-kicd
- Rounds: 17 (Round 0 토폴로지 + Round 1-17 Socratic, 1× Contrarian, 1× Simplifier)
- Final Ambiguity Score: ~14%
- Type: greenfield
- Generated: 2026-05-14 (v4 — Round 16-17 시드 전략 + IG 리스크 fallback 추가)
- Threshold: 0.20
- Initial Context Summarized: no
- Status: PASSED — pending approval

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Goal Clarity | 0.90 | 0.40 | 0.360 |
| Constraint Clarity | 0.86 | 0.30 | 0.258 |
| Success Criteria | 0.80 | 0.30 | 0.240 |
| **Total Clarity** | | | **0.858** |
| **Ambiguity** | | | **0.142** |

## Topology

| Component | Status | Description | Coverage / Deferral Note |
|---|---|---|---|
| Ingestion | active | IG 자동 크롤링 (공연·페스티벌 메타 수집) | 소스=IG 단일, 100% 자동, 운영자 게시물 승인 없음 |
| Normalization | active | IG 텍스트→Show 또는 Festival+Shows 추출, Setlist는 별도 경로 | 게시물 유형 자동 판별, 출력 모드 2개 (단독공연 1 Show / 페스티벌 1 Festival+N Shows). Setlist는 optional, 운영자가 admin 페이지에서 구조화 입력 |
| Discovery UI | active | 검색 중심 익명 공개 웹 + 공연·페스티벌 상세 + Admin | 검색 결과 표시는 **컨텍스트별 적응** (페스티벌명 검색 vs 아티스트명 검색). 지난 공연도 1급 검색 대상 (아카이브 성격) |
| Personalization (알림·팔로우·즐겨찾기) | deferred | 좋아하는 아티스트/베뉴/페스티벌 팔로우 및 알림 | **deferred at Round 0** — MVP 범위에서 보류. V2에서 OAuth 로그인과 함께 재검토 |

## Goal
사용자가 **전국 인디 씬**의 단독 공연·**페스티벌 라인업**·**지난 공연 아카이브와 셋리스트**를 **검색**해 찾을 수 있는 **익명 공개 웹사이트**를 만든다. 공연 메타와 페스티벌 라인업은 인스타그램 게시물에서 **완전 자동으로 수집·정규화**되어 채워지고, **셋리스트는 운영자가 공연 후 YouTube 영상 등을 참고해 admin 페이지에서 구조화 입력**한다. 단순 aggregator가 아니라 **검색 가능한 인디 공연·페스티벌 아카이브**가 핵심 가치다.

## Constraints
- **데이터 소스(자동)**: MVP는 인스타그램 단일. OCR·외부 티켓 사이트·베뉴 홈페이지 자동 크롤은 MVP 밖.
- **데이터 소스(수동 보조)**: 셋리스트 입력 시 운영자가 YouTube 등 외부 채널 자유롭게 참고. 시스템이 자동 크롤하지는 않음.
- **수집 모델**: 100% 자동 크롤링. 운영자의 게시물별 승인 없음.
- **페스티벌 라인업 추출**: 포스터 이미지 OCR이 아닌 **IG 게시물 본문 텍스트**에서 추출 (한국 인디 페스티벌 게시 관행에 부합).
- **공연 범위**: 국내(전국) 인디 씬.
- **인증 모델**:
  - **엔드유저**: V1 완전 익명.
  - **관리자**: 최소 인증을 갖춘 전용 admin 페이지 (셋리스트·페스티벌 보정용).
  - V2에서 엔드유저 OAuth 추가 가능하도록 stable URL 유지.
- **품질 컷오프 (게시 조건)**:
  - **Show (단독공연)**: `날짜 + 공연장 + 아티스트` 3필드 모두 추출 성공 시에만 게시.
  - **Festival**: `name + start_date` 필수.
  - **Show (페스티벌 set)**: `festival_id + artist` 필수. `date`는 `festival.start_date`, `venue`는 `festival.location`에서 상속해 3필드 컷오프를 자연 통과. Day/Stage/Time이 추가되면 보강.
  - 셋리스트는 어느 쪽도 게시 컷오프에 영향 없음.
- **운영 부담 목표**: 운영자가 손대는 시간 ≤ 30분/주 (크롤러 모니터링·예외 복구 기준; 셋리스트 입력 시간은 별도 자율).
- **데이터 라이프사이클**: **지난 공연·지난 페스티벌도 영구 보존**, 기본 검색에 포함.
- **법적 회색지대**: IG 약관·저작권 관리. 차단 시 백오프, 원문은 링크로만 노출. 포스터 이미지는 원문 링크로 처리, 자체 저장은 thumbnail-level만.
- **시드 IG 계정 전략 (Round 16)**:
  - 초기 시드: 운영자가 admin에서 **페스티벌 IG 5-10개**를 수동 입력.
  - 자동 확장: 페스티벌 라인업 게시물 본문의 `@artist_handle` 멘션에서 발견된 아티스트 IG 계정을 **자동으로 시드 리스트에 추가**, 다음 주기부터 추적 시작. 운영자는 admin에서 **제거만 제어** (pull-out semantics).
  - 베뉴 IG: MVP에서는 별도 추적하지 않음. Venue 엔티티는 Show 게시물 본문에서 텍스트로만 추출. IG handle 필드는 V2.
  - 인디 씬 필터링: 별도 임계값 없음. 라인업에 등장하면 메이저 아티스트도 추적 (인디 경계는 운영자 사후 제거로 관리).
- **IG 리스크 fallback (Round 17)**:
  - V1은 IG가 막을 수 있다는 전제 하에 설계.
  - 차단·약관 클레임 시 대응: **archive-only fallback**. 크롤러는 일시정지, 새 데이터 수집 중단. 웹사이트는 기존 DB(공연·페스티벌·셋리스트)로 계속 작동.
  - 우회·진화 전술(User-Agent rotation, IP 로테이션 등)은 V1 범위에서 적극 채택하지 않음. Gentle pacing·robots-respecting 만 적용.
  - 운영자에게 크롤러 정지/오류율 급증 시 알림 (이메일·Slack 등 — 구현은 plan 단계).

## Non-Goals
- 운영자 게시물별 수동 승인 (Round 4 Contrarian에서 제거)
- 포스터 이미지 OCR (Round 14에서 사용자가 불필요 판단)
- 자동 셋리스트 추출 (Round 11 best-effort optional)
- YouTube 자동 크롤링
- 엔드유저 회원가입·로그인·즐겨찾기·알림 (MVP 보류)
- IG 외 자동 데이터 소스
- 캘린더·지도·지역 페이지 등 검색 외 메인 뷰
- 티켓 결제·예매 자체 호스팅
- Stage를 별도 엔티티로 정규화 (Show.stage 문자열로 단순화)
- 베뉴 IG 계정 자동 추적 (MVP 보류)
- IG 차단 회피용 User-Agent rotation·IP rotation·헤드리스 브라우저 evasion 등 능동적 anti-detection
- 인디 씬 아티스트 자동 필터링 (운영자 사후 제거로 관리)
- 다국어 (V1 한국어 전용)

## Acceptance Criteria
- [ ] IG 단일 소스 자동 크롤러가 운영자 개입 없이 주기적으로 작동한다.
- [ ] Normalization이 게시물 유형(단독공연 vs 페스티벌 라인업/타임테이블)을 자동 판별한다.
- [ ] 단독공연 게시물에서 `날짜·공연장·아티스트` 3필드를 추출하고, 하나라도 빠지면 자동 폐기/재시도된다.
- [ ] 페스티벌 게시물에서 `이름·기간·라인업 아티스트들`을 추출해 Festival 1개와 묶인 Show N개를 생성한다.
- [ ] Show의 페스티벌 set은 `date`·`venue`를 Festival에서 자동 상속해 페스티벌 단위 카드와 개별 set 카드 모두 일관된 검색 결과로 노출된다.
- [ ] 게시된 모든 Show가 3필드를 100% 보유한다 (상속 포함, 빈 카드 0건).
- [ ] 공개 웹에서 로그인 없이 아티스트·베뉴·페스티벌·키워드 검색이 동작하며, **지난 공연·지난 페스티벌도 기본 결과에 포함**된다.
- [ ] 검색 결과는 **컨텍스트별로 적응**:
  - 검색어가 페스티벌명에 매칭되면 → Festival 카드 1장(대표 이미지+기간+라인업 축약) 상단, 그 안의 개별 Show 카드는 결과 리스트에 추가 노출되지 **않음**.
  - 검색어가 아티스트명에 매칭되면 → 그 아티스트의 Show 명단이 펼쳐지고, 페스티벌 출연 건은 카드에 "구경하는 쿠번 페스티벌 2026 · Day1 · Main" 같은 배지로 표시됨.
  - 검색어가 베뉴/키워드면 → Show 카드 명단 + 페스티벌 카드가 시각적으로 구분되어 섞여 노출.
- [ ] 결과 카드 클릭 시 사이트 내 상세 페이지로 이동:
  - **Show 상세**: 날짜·장소·아티스트·IG 원문·티켓 링크·(있으면) Setlist + 페스티벌 set이면 부모 Festival 링크.
  - **Festival 상세**: 이름·기간·장소·티켓·라인업 (Day×Stage 격자, 가능 정보까지 채움)·각 아티스트별 set 셋리스트 링크.
- [ ] 상세 페이지에 Setlist가 있으면 **곡 순서·앵콜 표시**까지 구조화되어 노출되고, 없으면 "셋리스트 미등록".
- [ ] 관리자가 admin 페이지에서 다음 작업이 가능하다:
  - Setlist 곡 추가/수정/재정렬, 앵콜·커버 표시.
  - Festival의 잘못 추출된 필드 보정 (라인업 누락 보강, stage·day 보강, 잘못 묶인 Show 분리/병합).
- [ ] Admin 페이지는 최소 인증(예: 비밀번호 또는 토큰)으로 보호된다.
- [ ] 운영자가 일주일에 손대는 시간 ≤ 30분 (크롤러 모니터링·예외 복구).
- [ ] V2에서 엔드유저 로그인 추가 시 기존 Show·Festival URL이 깨지지 않도록 stable URL 스킴 사용.
- [ ] 초기 시드는 운영자가 admin에서 페스티벌 IG 5-10개 입력으로 부트스트랩 가능하다.
- [ ] 페스티벌 라인업 게시물에서 멘션된 아티스트 IG 핸들이 자동으로 시드 리스트에 추가되고, 다음 크롤링 주기부터 추적된다.
- [ ] 운영자는 admin에서 시드 리스트의 어떤 계정이든 제거할 수 있고, 제거 후엔 추적 중단된다.
- [ ] 크롤러가 IG 차단·오류로 정지되어도 웹사이트는 기존 DB로 정상 동작한다 (archive-only mode).
- [ ] 크롤러 정지/오류율 급증 시 운영자에게 알림이 발생한다.

## Assumptions Exposed & Resolved
| Assumption | Challenge (Round) | Resolution |
|---|---|---|
| 운영자가 모든 IG 게시물을 검토·승인 | Round 4 (Contrarian) | 승인 단계 **제거** |
| MVP부터 여러 데이터 소스 | Round 6 (Simplifier) | MVP는 **IG 단일** |
| 데이터 풍부함이 1순위 | Round 8 | **운영 지속성**이 1순위 |
| V1 완전 익명 = 백엔드 거의 없음 | Round 9 | 엔드유저 익명, **admin은 최소 인증** |
| 카드 클릭 시 IG 원문 점프로 충분 | Round 7 | **사이트 내 상세 페이지** |
| 추출 실패해도 부분 정보로 노출 | Round 5 | **3필드 모두** 있을 때만 게시 |
| 지난 공연은 자동 만료 | Round 10 | **영구 보존 + 기본 검색에 포함** |
| 셋리스트도 IG에서 자동 추출 가능 | Round 11 | optional, 운영자 admin 입력 |
| 페스티벌도 Show 모델로 충분 | Round 13 | **Festival entity 추가** + Show.festival_id |
| 페스티벌 라인업은 포스터 OCR 필요 | Round 14 | **IG 본문 텍스트로 추출 가능** (사용자 도메인 지식 신호) |
| 페스티벌 카드 = Show 카드 동일 표시 | Round 15 | **컨텍스트별 적응** 표시 |
| 시드 IG 계정 리스트는 어떻게 채워지나 | Round 16 | **페스티벌 IG 수동 시드 + 라인업 게시물에서 아티스트 핸들 자동 발견 (snowball)**. 운영자는 제거만 |
| MVP가 베뉴 IG도 추적해야 한다 | Round 16 | **베뉴 IG 추적 X (V2)**. Venue는 Show 게시물 본문 텍스트로만 추출 |
| "인디" 정의로 메이저 아티스트 자동 필터링 | Round 16 | **필터링 없음**. 운영자 사후 제거로 관리 |
| IG 차단 시 어떻게 살아남나 | Round 17 | **Archive-only fallback**. 우회 evasion 없음, 차단 시 데이터 수집만 중단, 웹은 정상 작동 |

## Technical Context (Greenfield)
- 빈 작업 폴더(`/Users/k5d/Desktop/claude/mft`)에서 시작.
- 후속 omc-plan에서 결정할 항목:
  - **크롤러 런타임**: IG 공개 게시물 HTML / 비공식 API / 헤드리스 브라우저. 차단 백오프 필수.
  - **정규화 파이프라인**: LLM 기반 추출. **게시물 유형 분류기 (단독공연 / 페스티벌 / 셋리스트 / 무관) 필요.** 단독공연/페스티벌 분기 출력 스키마 명세 필요.
  - **검색 인덱스**: 한국어 형태소 처리 (예: Meilisearch·Algolia·Postgres FTS + nori). **Festival·Show·Artist·Venue 다중 엔티티 색인 + 검색어 의도 분류 (페스티벌명 vs 아티스트명 vs 베뉴명)** 필요.
  - **프론트엔드**: Next.js 등 SSR/SSG 가능 스택 (SEO·stable URL).
  - **Admin auth**: 최소 (basic auth, magic-link, 단일 비밀번호) — 운영자 1인 가정.
  - **호스팅**: 서버리스/매니지드 우선.
  - **크롤러↔웹 분리**: archive-only fallback이 가능하도록 크롤러를 stateless 작업으로 분리, 웹은 DB만 읽으면 살아 있음. (예: 크롤러는 cron job/worker, 웹은 별도 프로세스.)
  - **알림 채널**: 크롤러 정지/오류율 급증 알림 경로 (이메일·Slack·Discord 중 택).
- **개발 순서 (Round 16에서 사용자 질문에 대한 답):**
  - Day 0: 데이터 스키마 합의·고정 (Festival·Show·Setlist·Song·Artist·Venue·InstagramPost·AdminUser).
  - Week 1-2: IG 크롤러 PoC + 시드 5-10 페스티벌 IG로 viable 검증.
  - Week 3-5: Normalization 파이프라인 (단독공연/페스티벌 유형 분류·추출).
  - Week 6-8: 검색 인덱스 + 공개 웹 UI (Show·Festival 카드, 컨텍스트별 적응 표시).
  - Week 9: Admin 페이지 (셋리스트·시드 관리·페스티벌 보정).
  - 병행 가능 조각: Admin 셋리스트 입력 UI는 크롤러와 독립이라 일찍 시작 가능.

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Show (공연) | core domain | id, date, start_time?, venue_id, artist_ids[], title?, original_post_url, ticket_url?, image_url?, raw_text_excerpt, festival_id?, stage?, set_order?, created_at, updated_at | belongs_to Venue; has_many Artists; has_one_optional Setlist; **belongs_to_optional Festival** |
| Artist (아티스트) | core domain | id, canonical_name, aliases[], ig_handle?, first_seen_at | has_many Shows |
| Venue (공연장) | core domain | id, name, address?, region/district?, lat?, lng?, ig_handle? | has_many Shows; **may host Festival** |
| Festival (페스티벌) | core domain | id, name (canonical), aliases[], start_date, end_date, venue_id?, location_text?, official_url?, ticket_url?, ig_handle?, poster_image_url?, description?, created_at, updated_at | has_many Shows (set들); optional_belongs_to Venue |
| InstagramPost (원문 게시물) | external system | url, source_account, posted_at, raw_text, image_urls[], post_type? (single_show/festival_lineup/setlist/unrelated), extracted_show_id?, extracted_festival_id? | produces Show or Festival(+Shows) |
| Setlist (셋리스트) | core domain | id, show_id, source_notes?, updated_at | belongs_to Show; has_many Songs |
| Song (곡) | core domain | id, setlist_id, title, order, is_encore, cover_of? | belongs_to Setlist |
| AdminUser | supporting | id, login_id, password_hash 또는 token | (단독, 운영자 1인 가정) |

**총 8개 엔티티.** Festival은 Round 13에서 추가, 나머지 7개는 v2에서 유지.

## Ontology Convergence

| Round | Entity Count | New | Changed | Stability Ratio |
|---|---|---|---|---|
| 1-10 | 4→4 | — | — | 100% (stable from R4) |
| 11 | 5 (+Setlist) | 1 | — | 80% |
| 12 | 7 (+Song, AdminUser) | 2 | — | 71% |
| 13 | 8 (+Festival) | 1 | 1 (Show: +festival_id/stage/set_order) | 88% |
| 14 | 8 | 0 | 1 (InstagramPost: +post_type 분류 필드) | 100% |
| 15 | 8 | 0 | 0 | 100% |

**해석:** Round 11-13 확장 단계, Round 14-15 안정. 페스티벌 도입은 모델을 깨끗하게 흡수했다 (Show에 3개 optional FK/필드 추가 + Festival 1개 신설).

## Interview Transcript

<details>
<summary>Full Q&A (Round 0 + Round 1-15)</summary>

### Round 0 — 토폴로지 확인
**A:** Personalization 보류, 3개 active.

### Round 1 — Ingestion / Goal
**A:** 하이브리드 (크롤링+승인) → Round 4에서 변경됨. **Ambiguity:** 84%→74%

### Round 2 — Discovery UI / Goal
**A:** 검색 중심. **Ambiguity:** 74%→68%

### Round 3 — Cross-cutting / Constraint
**A:** 전국 인디 씬. **Ambiguity:** 68%→64%

### Round 4 — Contrarian
**A:** 아예 승인 제거 (크롤링만). **Ambiguity:** 64%→57%

### Round 5 — Normalization / Goal+Criteria
**A:** 날짜+공연장+아티스트 필수. **Ambiguity:** 57%→45%

### Round 6 — Simplifier
**A:** MVP는 IG만. **Ambiguity:** 45%→37%

### Round 7 — Discovery UI / Constraints+Criteria
**A:** 사이트 내 상세 페이지. **Ambiguity:** 37%→31%

### Round 8 — Cross-cutting / Criteria
**A:** 운영 지속 가능성. **Ambiguity:** 31%→21%

### Round 9 — Cross-cutting / Constraints
**A:** MVP는 익명, V2에서 로그인. **Ambiguity:** 21%→18.5%

### Round 10 — Discovery UI / Criteria
**A:** 지난 공연도 검색 결과 포함, 셋리스트 중요. **Ambiguity:** 18.5%→29%

### Round 11 — Normalization / Goal
**A:** 셋리스트는 YouTube 참고해 운영자 입력, 없으면 비워둠. **Ambiguity:** 29%→22%

### Round 12 — Normalization / Goal+Constraints
**A:** 구조화 (곡 목록·순서·앵콜) + 전용 admin 페이지. **Ambiguity:** 22%→16.6%

### Round 13 — Festival Ontology
**Q:** 페스티벌 데이터 모델 구조는?
**A:** B안 — Festival 엔티티 + Show.festival_id. **Ambiguity:** ~19%

### Round 14 — Festival Ingestion
**Q:** 페스티벌 라인업 데이터의 주된 입력 경로는?
**A:** OCR 불필요, IG 게시글 본문 텍스트로 라인업 파악 가능. 셋리스트는 (기존 결정대로) 수동 입력. **Ambiguity:** ~18%

### Round 15 — Festival Discovery UI
**Q:** 페스티벌의 검색 결과 표시 방식?
**A:** 컨텍스트별 적응 (페스티벌명 검색 시 1카드, 아티스트명 검색 시 페스티벌 출연 배지). **Ambiguity:** ~16%

### Round 16 — 시드 IG 계정 전략
**User question first:** 웹사이트와 크롤러 동시 개발이 효율적인가? → 순차 추천 (크롤링 viable 검증 우선).
**Q:** 시드 IG 계정 리스트는 어떻게 채우나? + 발견된 계정의 자동/수동 추가, 베뉴 IG 처리, 인디 필터링.
**A:**
- 운영자가 페스티벌 IG 시드 입력 → 라인업 게시물의 아티스트 핸들 자동 발견 (snowball)
- 자동 추가, 운영자는 제거만
- 베뉴 IG는 MVP에서 추적 안 함 (V2)
- 인디 필터링 없음, 모든 아티스트 추적
**Ambiguity:** ~16% → ~15%

### Round 17 — IG 차단·약관 리스크 fallback
**Q:** IG 차단·약관 클레임 시 대응?
**A:** Archive-only fallback. MVP는 차단 감수, 우회 evasion 없음. 차단 시 수집만 중단하고 웹은 기존 DB로 계속 작동.
**Ambiguity:** ~15% → ~14%

</details>
