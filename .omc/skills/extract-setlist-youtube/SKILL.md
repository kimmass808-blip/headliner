---
name: extract-setlist-youtube
description: 유튜브 공연 풀영상 링크에서 셋리스트를 추출해 기존 stash→reconcile 파이프라인으로 DB에 부착한다. 1차 출처는 업로더가 단 챕터/설명 타임스탬프(setlist.fm 등 외부 DB 미사용). "유튜브 셋리스트", "영상에서 셋리스트 추출", "공연 풀영상 셋리스트" 요청 시 사용.
---

# extract-setlist-youtube

유튜브 공연 풀영상 **링크 1개 → 셋리스트**를 추출해 DB에 부착하는 스킬.

## 왜 이 방식인가 (중요)
- 1차 출처는 **영상 업로더가 직접 단 타임스탬프(챕터/설명)**. 실제 공연 흐름에 가장 정확.
- **setlist.fm 등 외부 DB를 긁지 않는다** → 약관/저작권/차단 리스크 회피. (setlist.fm은
  스크래핑·상업적 사용·자체 DB 저장을 약관으로 금지함.)
- 곡명은 **영상 표기 그대로** 텍스트 저장(앞의 "1. " 인덱스만 제거). Track 음원 연동 안 함.

## 아키텍처 (기존 자산 재사용)
```
[유튜브 링크] → yt-dlp(챕터/설명) → 파싱 → .omc/setlists/<igHandle>.json (stash)
                                                      ↓
                              scripts/reconcile-setlists.ts (기존)
                              아티스트+날짜로 Show 매칭 · 비파괴 · 멱등 → DB 부착
```
새로 만든 건 "링크 → stash" 변환부(`scripts/extract-setlist-youtube.ts`)뿐.
DB 매칭/부착의 어려운 부분은 이미 있던 `reconcile-setlists`가 처리한다.

## 사전 요구
- `yt-dlp` 설치 (`brew install yt-dlp`)
- 부착하려면 해당 **아티스트와 공연일(Show/ShowSession)이 이미 DB에 존재**해야 함.
  없으면 stash에 보류됐다가, 나중에 Show가 생기면 reconcile 재실행 시 자동 부착(멱등).

## 사용법 (링크 1개)
```bash
# 1) 미리보기 (파일·DB 안 건드림) — 곡 추출이 맞는지 먼저 확인
pnpm extract-setlist-yt --url "<youtube link>" --artist <igHandle> --dry-run

# 2) stash 적립 (로컬 파일 .omc/setlists/<igHandle>.json 에 append)
pnpm extract-setlist-yt --url "<youtube link>" --artist <igHandle>

# 3) 부착 미리보기 → 실제 부착
pnpm reconcile-setlists --only=<igHandle> --dry-run
pnpm reconcile-setlists --only=<igHandle>
```

### 옵션
- `--date YYYY-MM-DD` 날짜 직접 지정(기본: 제목의 YYMMDD/YYYY.MM.DD, 없으면 업로드일=주의)
- `--kind festival|solo|university|broadcast` (기본: 제목으로 추론)
- `--event "이름"` / `--venue "장소"` 직접 지정
- `--artist-name "표시명"` DB 조회 대신 직접 지정
- `--with-comments` 타임스탬프 댓글(잼/커버 수동확인용)도 함께 출력

## 파싱 규칙
- 곡 출처 우선순위: **챕터 > 설명란 타임스탬프 > 댓글의 팬 타임라인**. 셋 다 없으면 실패(수동 보강).
  - 댓글 파싱은 `--with-comments` 필요. 타임스탬프(MM:SS)가 가장 많은 댓글(4개 이상)을 자동 선택.
- 비-곡 섹션 스킵: `입장/Intro/Outro/오프닝/엔딩/ending/ment/멘트/맨트/talk/MC/인사/interlude`,
  한국어 무대 라벨 `시작/준비/마무리/포토타임/감사(합니다)/하이라이트`, 솔로 `drum solo/기타솔로/solo` 등.
- `앙코르/encore/앵콜` 단독 챕터 = 구간 마커 → 이후 곡 `isEncore=true`. `모두 그래(앵콜)`처럼 괄호 표기도 인식.
- 정제: 선두 인덱스(`1. `)·선두 구분자(`| - :`)·후행 팬코멘트(`(my fav)`)·후행 괄호(`(앵콜)`) 제거.
  그 외 곡명은 그대로 유지(`Machineboy空`, `T + Tik Tak Tok` 등).

## 한계 / 주의
- 챕터/타임스탬프가 **아예 없는 영상**은 자동 추출 불가 → 실패 종료(2). 수동 보강 필요.
- 잼 구간의 커버(예: Seven Nation Army)는 챕터에 없으면 자동으로 안 들어감.
  `--with-comments` 로 확인 후 필요 시 stash JSON을 직접 편집(`coverOf` 추가).
- `T + Tik Tak Tok` 처럼 한 챕터에 묶인 곡은 묶인 채로 1줄 저장(영상 표기 그대로 정책).
  분리하려면 stash JSON 수동 편집.
- **프로덕션 DB 안전**: 부착은 additive(기존 셋리스트 있으면 보호). 그래도 실행 전 `--dry-run` 권장.

## 향후 (2단계: 검색 → 일괄)
아직 미구현. 설계 방향:
1. 아티스트별로 유튜브 검색(`yt-dlp "ytsearch20:<아티스트> live 풀영상"` 등)으로 후보 링크 수집.
2. 각 링크에 이 스킬 1단계 실행 → 같은 stash 파일에 누적(중복 URL 자동 스킵).
3. `reconcile-setlists` 한 번 실행으로 매칭되는 Show 전부 부착.
주의: 검색 자동수집은 오인식(다른 공연/팬캠/리액션 영상) 위험이 있어 사람이 링크목록을
한 번 훑는 단계를 두는 게 안전하다.

## 관련 파일
- `scripts/extract-setlist-youtube.ts` — 추출/적립 본체
- `scripts/run-extract-setlist-youtube.sh` — nvm22+.env 런처
- `scripts/reconcile-setlists.ts` — stash→DB 부착(기존)
- `.omc/setlists/<igHandle>.json` — stash 적립 파일
