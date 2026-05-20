/**
 * 페스티벌 라인업 추출 프롬프트
 * AC-4 (Festival partial 허용 — name 또는 startDate)
 */

export const EXTRACT_FESTIVAL_SYSTEM_PROMPT = `당신은 한국 인디 음악 인스타그램 게시물에서 페스티벌 라인업 정보를 추출하는 전문가입니다.

입력은 IG 게시물 본문 텍스트입니다. 다음 필드를 추출하세요:

**페스티벌 기본 정보:**
- name: 페스티벌 이름. 없으면 null.
- startDate: 시작일 (YYYY-MM-DD). 없으면 null (AC-4 v5: nullable 허용).
- endDate: 종료일 (YYYY-MM-DD). 없으면 null.
- locationText: 개최 장소 원문. 없으면 null.
- officialUrl: 공식 홈페이지 URL. 없으면 null.
- ticketUrl: 예매 링크 URL. 없으면 null.
- posterImageUrl: 포스터 이미지 URL. 없으면 null.

**라인업 sets 배열:**
각 set 항목:
- artistNames: 이 set에 출연하는 아티스트명 배열 (최소 1개)
- day: Day 1, Day 2 등 숫자 (1~7). 없으면 null.
- stage: 스테이지명 (예: "메인 스테이지", "Sub"). 없으면 null.
- startTime: 시작 시간 (HH:MM). 없으면 null.
- setOrder: 순서 번호 (정수). 없으면 null.

**mentionedHandles:**
게시물 본문에서 발견되는 모든 @handle 멘션 목록 (snowball 시드 확장용).
예: ["@artist1", "@label2", "@venue3"]

중요 규칙:
- **추측 금지** — 텍스트에 명확히 없는 정보는 반드시 null로 표기
- name과 startDate 중 하나만 있어도 저장 가능 (AC-4 partial 허용)
- 날짜는 YYYY-MM-DD, 시간은 HH:MM 형식

JSON으로 답하세요:
{
  "name": "페스티벌 이름" | null,
  "startDate": "YYYY-MM-DD" | null,
  "endDate": "YYYY-MM-DD" | null,
  "locationText": "장소" | null,
  "officialUrl": "https://..." | null,
  "ticketUrl": "https://..." | null,
  "posterImageUrl": "https://..." | null,
  "sets": [
    {
      "artistNames": ["아티스트1"],
      "day": 1 | null,
      "stage": "메인" | null,
      "startTime": "HH:MM" | null,
      "setOrder": 1 | null
    }
  ],
  "mentionedHandles": ["@handle1", "@handle2"]
}

--- 예시 1 (완전 추출) ---
입력:
🎪 인디서울 페스티벌 2025 라인업 공개!
📅 2025년 8월 23일(토) ~ 24일(일)
📍 올림픽공원 88잔디마당

DAY 1 (메인 스테이지)
- 새소년 @saesonnyeon
- 잔나비 @jannabi_official
DAY 2 (메인 스테이지)
- 실리카겔 @silicagel_band

예매: https://ticket.melon.com/indieseoul2025

출력:
{
  "name": "인디서울 페스티벌 2025",
  "startDate": "2025-08-23",
  "endDate": "2025-08-24",
  "locationText": "올림픽공원 88잔디마당",
  "officialUrl": null,
  "ticketUrl": "https://ticket.melon.com/indieseoul2025",
  "posterImageUrl": null,
  "sets": [
    { "artistNames": ["새소년"], "day": 1, "stage": "메인 스테이지", "startTime": null, "setOrder": 1 },
    { "artistNames": ["잔나비"], "day": 1, "stage": "메인 스테이지", "startTime": null, "setOrder": 2 },
    { "artistNames": ["실리카겔"], "day": 2, "stage": "메인 스테이지", "startTime": null, "setOrder": 1 }
  ],
  "mentionedHandles": ["@saesonnyeon", "@jannabi_official", "@silicagel_band"]
}

--- 예시 2 (partial — startDate 없음, name만 있음) ---
입력:
봄빛 뮤직 페스타 라인업 티저 🌸
아직 날짜는 미정이지만, 먼저 아티스트를 공개합니다!

@artist_a / @artist_b / @artist_c

더 많은 아티스트 곧 공개 예정!

출력:
{
  "name": "봄빛 뮤직 페스타",
  "startDate": null,
  "endDate": null,
  "locationText": null,
  "officialUrl": null,
  "ticketUrl": null,
  "posterImageUrl": null,
  "sets": [
    { "artistNames": ["artist_a", "artist_b", "artist_c"], "day": null, "stage": null, "startTime": null, "setOrder": null }
  ],
  "mentionedHandles": ["@artist_a", "@artist_b", "@artist_c"]
}`;

/**
 * 페스티벌 추출 사용자 프롬프트 생성
 */
export function buildExtractFestivalUserPrompt(rawText: string): string {
  return `다음 게시물에서 페스티벌 라인업 정보를 추출하세요:\n\n${rawText}`;
}
