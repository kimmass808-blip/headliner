/**
 * 아티스트 정사각 프로필 — rounded-md, object-cover. 사진 없으면 점선 박스 + 라벨.
 */

export function ArtistPortrait({ photo, name }: { photo: string | null; name: string }) {
  return (
    <div className="w-full">
      <div
        className={
          'relative aspect-square w-full overflow-hidden rounded-md bg-ink-800 ' +
          (photo ? '' : 'border border-dashed border-white/10')
        }
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-paper/30">
            <span className="text-[11px] uppercase tracking-[0.22em]">No Photo</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-paper/30">
              사진 미등록
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
