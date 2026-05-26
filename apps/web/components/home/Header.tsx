/**
 * 홈 전용 다크 헤더.
 * 다른 페이지는 기존 `BrandHeader`(검정 배경 + 로고만) 그대로 유지.
 */

import Link from 'next/link';

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
    <header className="w-full hairline">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6 sm:px-10">
        <Link
          href="/"
          className="logo-headliner select-none text-[28px] tracking-tight text-paper sm:text-[32px]"
          aria-label="Headliner 홈"
        >
          HEADLINER
        </Link>

        {/* nav placeholder — 실제 인덱스 페이지는 미구현. 시안 일관성을 위해 표시만. */}
        <nav className="hidden items-center gap-8 text-[13px] tracking-[0.02em] text-paper/70 md:flex">
          <a href="#" className="transition hover:text-paper">
            공연
          </a>
          <a href="#" className="transition hover:text-paper">
            페스티벌
          </a>
          <a href="#" className="transition hover:text-paper">
            아티스트
          </a>
          <a href="#" className="transition hover:text-paper">
            아카이브
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#search"
            aria-label="검색"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-paper/80 transition hover:border-white/30 hover:text-paper"
          >
            <SearchIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
