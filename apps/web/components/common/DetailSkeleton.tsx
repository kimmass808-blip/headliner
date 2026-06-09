/**
 * 공연/페스티벌 상세 페이지(`/shows/[id]`·`/festivals/[id]`)의 로딩 스켈레톤.
 *
 * 두 페이지가 동일한 2단 레이아웃(좌: 포스터 / 우: 정보)을 쓰므로 공유.
 * 헤더는 유지한 채 포스터·제목·메타 자리에 회색 placeholder를 깐다.
 */
import { HomeHeader } from '../home/Header';

export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main>
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/5" />
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-16">
            {/* 포스터 자리 */}
            <div className="aspect-[3/4] w-full animate-pulse rounded-md bg-white/10" />

            {/* 정보 자리 — 제목 + 메타 라인 */}
            <div className="space-y-5 pt-2">
              <div className="h-9 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-white/5" />
              <div className="mt-8 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 w-full max-w-md animate-pulse rounded bg-white/5"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
