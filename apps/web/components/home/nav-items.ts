/** 헤더 네비 항목 — 데스크탑 nav와 모바일 메뉴가 공유. */
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/shows', label: '공연' },
  { href: '/festivals', label: '페스티벌' },
  { href: '/calendar', label: '캘린더' },
  { href: '/scrapped', label: '스크랩' },
];
