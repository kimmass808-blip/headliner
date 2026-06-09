/**
 * 아티스트 상세(`/artists/[id]`)·셋리스트 모음(`/artists/[id]/setlists`)의 로딩 스켈레톤.
 *
 * 두 페이지가 동일한 구조(헤더 / 뒤로가기 / Hero / 공연 그리드)를 공유한다.
 * `grids`로 그리드 개수 조절(상세=2: 다가오는·지난, 셋리스트=1).
 */
import { HomeHeader } from '../home/Header';
import { ShowsGridSkeleton } from './ShowsGridSkeleton';

export function ArtistPageSkeleton({ grids = 2 }: { grids?: number }) {
  return (
    <div className="min-h-screen bg-ink-900 pb-24 font-sans text-paper">
      <HomeHeader />
      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
        </section>

        {/* Hero — 아티스트 사진(원형) + 이름/별칭 */}
        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:px-10">
          <div className="flex items-center gap-6">
            <div className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-white/10 sm:h-36 sm:w-36" />
            <div className="space-y-3">
              <div className="h-8 w-48 animate-pulse rounded bg-white/10 sm:w-64" />
              <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </section>

        {Array.from({ length: grids }).map((_, i) => (
          <ShowsGridSkeleton key={i} count={4} />
        ))}
      </main>
    </div>
  );
}
