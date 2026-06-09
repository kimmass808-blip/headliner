/**
 * `/festivals` 로딩 스켈레톤. 공연 목록과 동일한 그리드 형태.
 */
import { HomeHeader } from '../../components/home/Header';
import { ShowsGridSkeleton } from '../../components/common/ShowsGridSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-10 sm:pt-16">
          {/* BackLink 자리 */}
          <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
        </section>
        <ShowsGridSkeleton />
      </main>
    </div>
  );
}
