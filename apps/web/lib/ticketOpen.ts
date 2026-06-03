/**
 * 예매 오픈 일시 표시 포맷.
 *
 * ticketOpenAt(DateTime)을 "6.15 (목) 20:00" 형태로 만든다.
 * 시각이 00:00이면 날짜만 추출된 것으로 보고 시간을 생략 → "6.15 (목)".
 * 지난 오픈일이어도 그대로 표시한다(표시 정책: 항상 노출 — 호출 측에서 거르지 않음).
 */

const WEEKDAY_KR_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function formatTicketOpen(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  const md = `${d.getMonth() + 1}.${d.getDate()}`;
  const dow = WEEKDAY_KR_SHORT[d.getDay()];
  const h = d.getHours();
  const m = d.getMinutes();
  const time =
    h === 0 && m === 0 ? '' : ` ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return `${md} (${dow})${time}`;
}
