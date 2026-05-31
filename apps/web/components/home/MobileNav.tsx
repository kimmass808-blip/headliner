'use client';

/**
 * 모바일 헤더 네비. 햄버거 버튼 + 헤더 아래 드롭다운 패널.
 * 데스크탑(md 이상)에서는 숨김 — 데스크탑은 HomeHeader의 가로 nav 사용.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { NAV_ITEMS } from './nav-items';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-paper/80 transition hover:border-white/30 hover:text-paper"
      >
        {open ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
      </button>

      {open && (
        <nav
          id="mobile-nav-panel"
          className="hairline absolute inset-x-0 top-[72px] z-50 flex flex-col bg-ink-900 px-6 py-2 text-[15px] tracking-[0.02em] text-paper/80 sm:px-10"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="border-b border-white/5 py-3.5 transition last:border-b-0 hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function MenuIcon({ className = '' }: { className?: string }) {
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
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({ className = '' }: { className?: string }) {
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
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
