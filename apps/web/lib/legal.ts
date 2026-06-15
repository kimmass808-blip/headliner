/**
 * 법적 문서(이용약관·개인정보처리방침) 공용 상수.
 *
 * 약관을 개정하면 LEGAL_VERSION을 올린다 → 기존 동의자(agreedVersion 불일치)는
 * 다음 로그인 시 재동의를 받도록 확장할 수 있다(현재는 최초 동의만 강제).
 */

export const LEGAL = {
  serviceName: 'Headliner',
  operator: 'Headliner 운영자',
  contactEmail: 'kimmass808@gmail.com',
  /** 약관·개인정보처리방침 버전(시행일 기준). 개정 시 갱신. */
  version: '2026-06-14',
  effectiveDate: '2026년 6월 14일',
} as const;
