/**
 * 검색 결과의 아티스트 섹션 — heading + ArtistRow 목록.
 */

import { ArtistRow, type ArtistRowData } from './ArtistRow';

export function ArtistSection({ artists }: { artists: ArtistRowData[] }) {
  if (artists.length === 0) return null;
  return (
    <section className="mx-auto mt-10 max-w-[1400px] px-6 sm:mt-12 sm:px-10">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-paper sm:text-[20px]">
            아티스트
          </h2>
          <span className="text-[12px] tabular-nums text-paper/40">
            {artists.length}
          </span>
        </div>
      </div>
      <div className="hairline-t">
        {artists.map((a) => (
          <ArtistRow key={a.id} artist={a} />
        ))}
      </div>
    </section>
  );
}
