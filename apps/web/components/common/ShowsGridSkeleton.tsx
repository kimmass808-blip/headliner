/**
 * PosterCard 그리드 페이지(/shows·/festivals 등)의 로딩 스켈레톤.
 *
 * 데이터 도착 전, 카드가 들어올 자리에 회색 placeholder를 그리드로 깔아
 * 레이아웃을 미리 보여준다(전체 화면 스피너 대체).
 * HomeHeader는 각 loading.tsx에서 별도로 렌더 → 헤더는 그대로 유지되는 느낌.
 */
export function ShowsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
      {/* heading + count + 정렬 토글 자리 */}
      <div className="hairline mb-10 flex items-end justify-between pb-6">
        <div className="flex items-baseline gap-3">
          <div className="h-8 w-40 animate-pulse rounded-md bg-white/10 sm:h-9 sm:w-52" />
          <div className="h-4 w-10 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-full bg-white/5" />
      </div>

      {/* 카드 그리드 — 실제 PosterCard와 동일한 1/2/4 컬럼·4:5 비율 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] w-full animate-pulse rounded-md bg-white/10" />
            <div className="mt-4 space-y-2 pr-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
