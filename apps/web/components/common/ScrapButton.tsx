/**
 * 스크랩 토글 버튼 — Show/Festival 상세 페이지 상단에 사용.
 *
 * 시각: 36×36 원형 (헤더 검색 버튼과 동일 사양).
 *  - 비스크랩: border-white/10, paper/70, hover border-white/30 + paper
 *  - 스크랩: border-lime/70, text-lime, fill=currentColor 채워진 북마크
 *
 * SSR 안전: 초기엔 항상 비스크랩으로 렌더 → mount 후 localStorage 읽어 sync.
 * 멀티탭 동기화: scrapStorage의 subscribe()로 같은 탭 + storage event 모두 커버.
 */

'use client';

import { useEffect, useState } from 'react';
import { BookmarkFilled, BookmarkOutline } from './Icons';
import {
  addScrap,
  isScrapped,
  removeScrap,
  subscribe,
  type Scrap,
} from '../../lib/scrapStorage';

export interface ScrapButtonProps {
  kind: Scrap['kind'];
  id: string;
}

export function ScrapButton({ kind, id }: ScrapButtonProps) {
  const [scrapped, setScrapped] = useState(false);

  useEffect(() => {
    setScrapped(isScrapped(kind, id));
    const unsub = subscribe(() => {
      setScrapped(isScrapped(kind, id));
    });
    return unsub;
  }, [kind, id]);

  function toggle() {
    if (scrapped) {
      removeScrap(kind, id);
    } else {
      addScrap(kind, id);
    }
    // subscribe 콜백이 곧 호출되지만, 즉시성을 위해 optimistic update
    setScrapped(!scrapped);
  }

  const label = scrapped ? '스크랩 해제' : '스크랩';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={scrapped}
      aria-label={label}
      title={label}
      className={
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ' +
        (scrapped
          ? 'border-lime/70 text-lime'
          : 'border-white/10 text-paper/70 hover:border-white/30 hover:text-paper')
      }
    >
      {scrapped ? (
        <BookmarkFilled className="h-4 w-4" />
      ) : (
        <BookmarkOutline className="h-4 w-4" />
      )}
    </button>
  );
}
