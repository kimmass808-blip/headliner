/**
 * 홈 다크 검색바 (pill shape).
 *
 * 기존 SearchForm의 라우팅 로직 보존: 제출 시 `/?q=...`.
 * NavigationOverlay가 form submit 이벤트를 감지해 전역 로딩 스피너를 띄움.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

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

function ArrowIcon({ className = '' }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

export function HomeSearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      router.push('/');
      return;
    }
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      id="search"
      onSubmit={submit}
      // #search 앵커로 점프 시 폼이 화면 상단이 아닌 세로 중앙에 오도록.
      // (뷰포트 절반 − 검색 pill 높이 절반)만큼 scroll-margin-top 부여.
      className="mx-auto max-w-3xl scroll-mt-[calc(50vh_-_2.25rem)]"
    >
      <div className="group relative flex h-[64px] items-center gap-4 rounded-full border border-white/10 bg-ink-850 px-5 transition hover:border-white/25 focus-within:border-paper focus-within:bg-ink-800 sm:h-[72px] sm:px-6">
        <SearchIcon className="h-5 w-5 shrink-0 text-paper/50 transition group-focus-within:text-paper" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="아티스트, 공연, 페스티벌, 장소를 검색하세요"
          className="search-input flex-1 bg-transparent text-[16px] text-paper outline-none placeholder:text-dim sm:text-[17px]"
          autoComplete="off"
        />
        <button
          type="submit"
          className="hidden h-[44px] items-center gap-2 rounded-full bg-paper px-5 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-900 transition hover:bg-paper/90 sm:inline-flex"
        >
          검색
          <ArrowIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
