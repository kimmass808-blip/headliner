/**
 * /admin/review — 검수 큐.
 *
 * Ingest 파이프라인이 새로 만든 모든 Show / Festival 은 status=PENDING 으로 들어옴.
 * 운영자가 여기서 정보를 확인·수정하고 승인 / 거절 / 삭제한다. 모든 액션은
 * ReviewLog 에 누적되어 ingest-show 보정 루프의 학습 신호로 쓰인다.
 */

import {
  loadArtistSuggest,
  loadFestivalOptions,
  loadPendingFestivalInfos,
  loadPendingFestivals,
  loadPendingShows,
} from '../../../components/admin/loaders';
import { ReviewQueue } from '../../../components/admin/ReviewQueue';

export const dynamic = 'force-dynamic';

export default async function AdminReviewPage() {
  const [shows, festivals, infos, festivalOptions, artistSuggest] = await Promise.all([
    loadPendingShows(),
    loadPendingFestivals(),
    loadPendingFestivalInfos(),
    loadFestivalOptions(),
    loadArtistSuggest(),
  ]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[16px] font-bold text-zinc-900">검수 큐</h1>
          <span className="text-[13px] text-zinc-400">사이트 공개 전 검수 · 수정</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">키보드로 빠르게 처리</div>
      </header>
      <ReviewQueue
        initialShows={shows}
        initialFestivals={festivals}
        initialInfos={infos}
        festivalOptions={festivalOptions}
        artistSuggest={artistSuggest}
      />
    </>
  );
}
