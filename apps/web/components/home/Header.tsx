/**
 * 홈 전용 다크 헤더.
 * 다른 페이지는 기존 `BrandHeader`(검정 배경 + 로고만) 그대로 유지.
 */

import Link from 'next/link';
import { MobileNav } from './MobileNav';
import { NAV_ITEMS } from './nav-items';

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function HomeHeader() {
  return (
    <header className="relative w-full hairline">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6 sm:px-10">
        <Link
          href="/"
          className="logo-headliner select-none text-[28px] tracking-tight text-paper sm:text-[32px]"
          aria-label="Headliner 홈"
        >
          HEADLINER
        </Link>

        {/* nav — 실제 라우팅된 항목만 표시. 데스크탑 전용. */}
        <nav className="hidden items-center gap-8 text-[13px] tracking-[0.02em] text-paper/70 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-paper">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/#search"
            aria-label="검색"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-paper/80 transition hover:border-white/30 hover:text-paper"
          >
            <SearchIcon className="h-4 w-4" />
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
