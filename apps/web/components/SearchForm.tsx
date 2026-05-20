'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function SearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQuery || params.get('q') || '');

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
    <form onSubmit={submit} className="mt-8">
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="아티스트, 페스티벌, 공연장"
        className="w-full border-b border-neutral-900 bg-transparent pb-3 text-2xl placeholder:text-neutral-300 focus:border-accent focus:outline-none"
        autoFocus
      />
    </form>
  );
}
