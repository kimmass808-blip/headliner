/**
 * 검색 결과의 아티스트 행 (다크 톤).
 * 카드가 아니라 가로 리스트 row — 한 검색에서 상단 강조 영역에 모음.
 */

import Link from 'next/link';

type Artist = {
  id: string;
  canonicalName: string;
  aliases: string[];
  igHandle: string | null;
};

export function ArtistResultCard({ artist }: { artist: Artist }) {
  return (
    <div className="hairline-t py-6 first:shadow-none">
      <p className="text-[11px] uppercase tracking-[0.3em] text-paper/45">
        Artist
      </p>
      <Link href={`/artists/${artist.id}`} className="group inline-block">
        <h3 className="mt-1 text-2xl font-semibold tracking-[-0.01em] text-paper transition group-hover:text-lime">
          {artist.canonicalName}
        </h3>
      </Link>
      {artist.aliases.length > 0 ? (
        <p className="mt-1 text-sm text-paper/55">
          {artist.aliases.join(' · ')}
        </p>
      ) : null}
      {artist.igHandle ? (
        <a
          href={`https://www.instagram.com/${artist.igHandle}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-paper/45 transition hover:text-paper"
        >
          @{artist.igHandle}
        </a>
      ) : null}
    </div>
  );
}
