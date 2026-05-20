/**
 * AC-7b (v4·v5.1) — 미완 Show 카드 배지 텍스트의 한글 매핑.
 * 단일 출처로 유지. UI 컴포넌트와 admin 보완 큐 양쪽이 이걸 import.
 */
export const MISSING_FIELD_LABELS: Record<'date' | 'venue' | 'artists', string> = {
  date: '날짜',
  venue: '장소',
  artists: '아티스트',
};

export type MissingFieldKey = keyof typeof MISSING_FIELD_LABELS;

/**
 * 누락 필드 배열 → 사용자에게 보일 배지 텍스트.
 * 예: ['date'] → '날짜 미정'
 * 예: ['date', 'venue'] → '날짜·장소 미정'
 */
export function formatMissingFieldsBadge(
  missingFields: MissingFieldKey[]
): string {
  if (missingFields.length === 0) return '';
  if (missingFields.length === 3) return '정보 부족 · 인스타에서 확인';
  const labels = missingFields.map((k) => MISSING_FIELD_LABELS[k]);
  return `${labels.join('·')} 미정`;
}
