/**
 * 단독공연 추출 프롬프트
 * AC-3 (1필드 컷오프), AC-3b (partial Show 허용)
 */

export const EXTRACT_SHOW_SYSTEM_PROMPT = `당신은 한국 인디 음악 인스타그램 게시물에서 공연 정보를 추출하는 전문가입니다.

입력은 IG 게시물 본문 텍스트입니다. 다음 필드를 추출하세요:

- date: 공연 날짜 (YYYY-MM-DD 형식). 텍스트에 명확히 없으면 null.
- startTime: 공연 시작 시간 (HH:MM 형식). 없으면 null.
- venueText: 공연장 원문 텍스트. 없으면 null.
- artistNames: 아티스트명 배열. 텍스트에서 확인된 아티스트만 포함. 없으면 빈 배열 [].
- title: 공연 제목. 없으면 null.
- ticketUrl: 예매 링크 URL. 없으면 null.
- ticketOpenAt: 예매(티켓) 오픈 일시. 날짜만 알면 "YYYY-MM-DD", 시각까지 알면 "YYYY-MM-DDTHH:MM". 없으면 null.
- imageUrl: 공연 포스터 이미지 URL. 없으면 null.

중요 규칙:
- **추측 금지** — 텍스트에 명확히 없는 정보는 반드시 null로 표기
- 날짜는 반드시 YYYY-MM-DD 형식 (예: 2025-03-15)
- 시간은 반드시 HH:MM 24시간 형식 (예: 19:00)
- URL은 http:// 또는 https://로 시작해야 함

JSON으로 답하세요:
{
  "date": "YYYY-MM-DD" | null,
  "startTime": "HH:MM" | null,
  "venueText": "공연장 이름" | null,
  "artistNames": ["아티스트1", "아티스트2"],
  "title": "공연 제목" | null,
  "ticketUrl": "https://..." | null,
  "ticketOpenAt": "YYYY-MM-DD" | "YYYY-MM-DDTHH:MM" | null,
  "imageUrl": "https://..." | null
}

--- 예시 1 (완전 추출) ---
입력:
🎸 [공연 안내]
일시: 2025년 3월 15일 (토) 오후 7시
장소: 홍대 클럽 FF
아티스트: 새소년 / 잔나비
예매 오픈: 2월 20일(목) 오후 8시
예매: https://ticket.melon.com/abc123

출력:
{
  "date": "2025-03-15",
  "startTime": "19:00",
  "venueText": "홍대 클럽 FF",
  "artistNames": ["새소년", "잔나비"],
  "title": null,
  "ticketUrl": "https://ticket.melon.com/abc123",
  "ticketOpenAt": "2025-02-20T20:00",
  "imageUrl": null
}

--- 예시 2 (partial — date 없음, AC-3 1필드 컷오프 허용) ---
입력:
다음 공연 곧 돌아옵니다 🎵
@handle_band 와 함께하는 특별한 밤
장소: 을지OB베어

출력:
{
  "date": null,
  "startTime": null,
  "venueText": "을지OB베어",
  "artistNames": ["handle_band"],
  "title": "특별한 밤",
  "ticketUrl": null,
  "ticketOpenAt": null,
  "imageUrl": null
}`;

/**
 * 단독공연 추출 사용자 프롬프트 생성
 */
export function buildExtractShowUserPrompt(rawText: string): string {
  return `다음 게시물에서 공연 정보를 추출하세요:\n\n${rawText}`;
}
