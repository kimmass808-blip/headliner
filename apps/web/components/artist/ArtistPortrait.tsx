/**
 * 아티스트 정사각 프로필 — rounded-md, object-cover. 사진 없으면 점선 박스 + 라벨.
 */

import { getImageUrl } from '../../lib/imageUrl';

export function ArtistPortrait({ photo, name }: { photo: string | null; name: string }) {
  // 상세 페이지의 정사각 프로필. 보통 한 컬럼 폭 280~320px → retina 고려 600px.
  const src = getImageUrl(photo, { width: 600, quality: 80, resize: 'cover' });
  return (
    <div className="w-full">
      <div
        className={
          'relative aspect-square w-full overflow-hidden rounded-md bg-ink-800 ' +
          (src ? '' : 'border border-dashed border-white/10')
        }
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
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
