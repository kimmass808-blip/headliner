/**
 * 홈(`/`) 로딩 스켈레톤 + 하위 라우트의 기본 fallback.
 *
 * 헤더는 유지한 채 히어로/검색 + 공연·페스티벌 그리드 자리를 회색 뼈대로 채운다.
 */
import { HomeHeader } from '../components/home/Header';
import { ShowsGridSkeleton } from '../components/common/ShowsGridSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main>
        <section className="mx-auto max-w-[1400px] px-6 pb-12 pt-10 sm:px-10 sm:pt-14">
          {/* 히어로 + 검색바 자리 */}
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
          <div className="mt-10 h-14 w-full animate-pulse rounded-full bg-white/5 sm:mt-12" />
        </section>
        <ShowsGridSkeleton count={4} />
        <ShowsGridSkeleton count={4} />
      </main>
    </div>
  );
}
