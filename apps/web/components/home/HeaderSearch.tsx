/**
 * 헤더 인라인 검색 — 아이콘 클릭 시 옆으로 입력창이 펼쳐짐.
 *
 * 닫힘: 원형 아이콘 버튼. 클릭 → 입력창이 좌측으로 슬라이드 확장 + 포커스.
 * 제출: `/?q=...` 로 이동(홈 검색바와 동일 라우팅).
 * 빈 채로 blur / Esc → 다시 닫힘.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

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

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    // 닫힌 상태에서 누르면 펼치기만(이후 effect가 포커스).
    if (!open) {
      setOpen(true);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) return; // 펼친 채 유지
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  }

  return (
    <form
      onSubmit={submit}
      className={
        'flex h-9 items-center overflow-hidden rounded-full border transition-[width,background-color,border-color] duration-300 ease-out ' +
        (open
          ? 'w-48 border-white/20 bg-ink-850 sm:w-64'
          : 'w-9 border-white/10 hover:border-white/30')
      }
    >
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => {
          if (!q.trim()) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQ('');
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="검색어 입력"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        className={
          'min-w-0 flex-1 bg-transparent pl-4 text-[13px] text-paper outline-none placeholder:text-dim ' +
          (open ? '' : 'pointer-events-none w-0')
        }
      />
      <button
        type="submit"
        aria-label="검색"
        className="flex h-9 w-9 shrink-0 items-center justify-center text-paper/80 transition hover:text-paper"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
