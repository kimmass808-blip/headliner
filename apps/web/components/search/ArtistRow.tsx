/**
 * 검색 결과의 아티스트 가로 row.
 * 아바타(72×72 원형) + 이름 + aliases + 우측 화살표.
 */

import Link from 'next/link';
import { ArrowIcon } from '../common/Icons';
import { getImageUrl } from '../../lib/imageUrl';

export interface ArtistRowData {
  id: string;
  name: string;
  aliasText: string | null;
  imageUrl: string | null;
}

export function ArtistRow({ artist }: { artist: ArtistRowData }) {
  // 검색 결과 행 — 72×72 원형 아바타. retina 고려 160px 요청.
  const src = getImageUrl(artist.imageUrl, { width: 160, quality: 78, resize: 'cover' });
  return (
    <Link href={`/artists/${artist.id}`} className="group block">
      <div className="hairline flex items-center gap-5 py-5 sm:gap-6 sm:py-6">
        {/* avatar */}
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-ink-700">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={artist.name}
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-paper/30">
              No photo
            </div>
          )}
        </div>

        {/* name + aliases */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-paper sm:text-[26px]">
              {artist.name}
            </h3>
            {artist.aliasText ? (
              <span className="text-[13px] tracking-[-0.005em] text-paper/45">
                {artist.aliasText}
              </span>
            ) : null}
          </div>
        </div>

        {/* arrow */}
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-paper/70 transition group-hover:border-white/30 group-hover:text-paper md:flex">
          <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
