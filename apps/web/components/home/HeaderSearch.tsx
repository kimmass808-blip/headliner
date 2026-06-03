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

  // submit은 "실제 이동"이 일어날 때만 발생해야 한다.
  // (NavigationOverlay가 document submit을 감지해 스피너를 띄우고, 라우트 변경
  //  시에만 해제하므로 — 이동 없는 submit은 무한 로딩을 유발한다.)
  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return; // disabled로 막혀 사실상 도달하지 않음(방어용)
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
          // 폰트 16px: iOS가 16px 미만 입력창 포커스 시 화면을 자동 확대하는 것 방지.
          'min-w-0 flex-1 bg-transparent text-[16px] text-paper outline-none placeholder:text-dim ' +
          // 닫힘: 패딩까지 0으로 접어 아이콘 버튼이 밀리지 않게.
          (open ? 'pl-4' : 'pointer-events-none w-0 p-0')
        }
      />
      <button
        type={open ? 'submit' : 'button'}
        // 닫힘: 펼치기만(submit 아님). 펼침+빈 검색어: disabled로 빈 submit 차단.
        disabled={open && !q.trim()}
        onClick={() => {
          if (!open) setOpen(true);
        }}
        aria-label="검색"
        className="flex h-9 w-9 shrink-0 items-center justify-center text-paper/80 transition hover:text-paper"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
