/**
 * `/calendar` 로딩 스켈레톤.
 * 헤더 유지 + 월 네비/요약/월 그리드(7열) 자리를 회색 뼈대로 채운다.
 */
import { HomeHeader } from '../../components/home/Header';

export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-[1320px] px-6 pb-16 pt-8 sm:px-10">
        {/* BackLink 자리 */}
        <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
        <div className="mt-8">
          {/* 월 네비 */}
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-32 animate-pulse rounded-full bg-white/5" />
          </div>
          {/* 요약 스트립 */}
          <div className="mt-6 h-10 w-full animate-pulse rounded bg-white/5" />
          {/* 월 그리드 — 7열 x 5주 */}
          <div className="mt-6 hidden grid-cols-7 gap-2 sm:grid">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded bg-white/5"
              />
            ))}
          </div>
          {/* 모바일 아젠다 */}
          <div className="mt-6 space-y-3 sm:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded bg-white/5"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
