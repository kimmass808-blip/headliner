/**
 * 예매처(티켓 판매 플랫폼) 파생 — 옵션 1
 *
 * ticketUrl을 별도 필드로 저장하지 않고, URL의 호스트네임에서 예매처명을 유추한다.
 * 표시 시점(웹/관리자)에서 호출. 매칭 실패 시 null.
 */

interface VendorRule {
  /** 호스트네임에 이 문자열이 포함되면 매칭 (소문자 비교) */
  match: string;
  label: string;
}

// 더 구체적인 규칙을 앞에 둔다 (예: nol.interpark 보다 interpark가 뒤).
const VENDOR_RULES: VendorRule[] = [
  { match: 'melon.com', label: '멜론티켓' },
  { match: 'ticket.yes24.com', label: 'YES24 티켓' },
  { match: 'yes24.com', label: 'YES24' },
  { match: 'ticketlink.co.kr', label: '티켓링크' },
  { match: 'nol.interpark.com', label: '인터파크 티켓' },
  { match: 'interpark.com', label: '인터파크 티켓' },
  { match: 'globalinterpark.com', label: '인터파크 티켓' },
  { match: 'tickets.interpark.com', label: '인터파크 티켓' },
  { match: 'booking.naver.com', label: '네이버 예약' },
  { match: 'map.naver.com', label: '네이버 예약' },
  { match: 'ticket.kyobobook.co.kr', label: '교보문고 티켓' },
  { match: 'onoffmix.com', label: '온오프믹스' },
  { match: 'forms.gle', label: '구글 폼' },
  { match: 'docs.google.com', label: '구글 폼' },
  { match: 'naver.me', label: '네이버' },
  { match: 'instagram.com', label: '인스타그램 DM' },
];

/**
 * 티켓 URL에서 예매처명을 유추한다.
 * @param ticketUrl 예매 링크 (null/undefined/빈문자 허용)
 * @returns 예매처명, 또는 매칭 실패·입력 없음 시 null
 */
export function ticketVendorFromUrl(ticketUrl: string | null | undefined): string | null {
  if (!ticketUrl) return null;

  let host: string;
  try {
    host = new URL(ticketUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const rule of VENDOR_RULES) {
    if (host.includes(rule.match)) return rule.label;
  }
  return null;
}
