/**
 * AC-7b — Show 카드 (미니멀 매거진 톤).
 *
 * 포스터 이미지 prominent (3:4 세로), 카드 border 없음.
 * 미완 정보는 옅은 회색 chip으로 표시.
 */

import Link from 'next/link';
import { formatMissingFieldsBadge, type MissingFieldKey } from '@mft/shared';

type Show = {
  id: string;
  date: Date | null;
  startTime: string | null;
  title: string | null;
  originalPostUrl: string;
  imageUrl: string | null;
  completeness: number;
  missingFields: string[];
  stage: string | null;
  venue: { id: string; name: string } | null;
  artists: Array<{ id: string; canonicalName: string }>;
  festival: { id: string; name: string } | null;
};

function formatDate(d: Date | null) {
  if (!d) return null;
  const date = new Date(d);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export function ShowCard({ show }: { show: Show }) {
  const c = show.completeness;
  const badge = formatMissingFieldsBadge(show.missingFields as MissingFieldKey[]);
  const dateStr = formatDate(show.date);
  const artists = show.artists.map((a) => a.canonicalName).join(', ');

  return (
    <Link href={`/shows/${show.id}`} className="group block">
      <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100">
        {show.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={show.imageUrl}
            alt=""
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              c < 3 ? 'opacity-90' : ''
            } group-hover:opacity-80`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <span className="text-xs uppercase tracking-widest">No poster</span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {artists ? (
          <p className="text-[15px] font-semibold text-neutral-900 group-hover:text-accent">
            {artists}
          </p>
        ) : null}
        {show.title ? (
          <p className="line-clamp-1 text-sm text-neutral-500">{show.title}</p>
        ) : null}
        <p className="text-xs text-neutral-500">
          {show.venue?.name ?? '장소 미정'}
        </p>
        <p className="text-xs text-neutral-400">
          {dateStr ?? '날짜 미정'}
          {show.startTime ? ` · ${show.startTime}` : ''}
        </p>
        {show.festival ? (
          <p className="text-[11px] uppercase tracking-wider text-accent">
            {show.festival.name}
            {show.stage ? ` · ${show.stage}` : ''}
          </p>
        ) : null}
        {badge ? (
          <p className="inline-block bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
            {badge}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
