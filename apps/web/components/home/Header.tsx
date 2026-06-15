/**
 * 홈 전용 다크 헤더.
 * 다른 페이지는 기존 `BrandHeader`(검정 배경 + 로고만) 그대로 유지.
 */

import Link from 'next/link';
import { MobileNav } from './MobileNav';
import { HeaderSearch } from './HeaderSearch';
import { NAV_ITEMS } from './nav-items';
import { AuthMenu } from '../auth/AuthMenu';

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
          <HeaderSearch />
          {/* 로그인 슬롯 — 클라이언트에서 세션을 읽는다(서버 쿠키 미사용 → 페이지 ISR 캐시 유지). */}
          <AuthMenu />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
