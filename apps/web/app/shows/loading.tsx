/**
 * `/shows` 로딩 스켈레톤.
 *
 * Next.js가 page.tsx의 데이터 조회를 기다리는 동안 이 화면을 즉시 보여준다.
 * 헤더는 그대로, 본문만 회색 뼈대 → 전체 화면 스피너보다 빠르게 느껴진다.
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
