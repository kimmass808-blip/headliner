/**
 * 검색 결과 없음 상태. 큰 옅은 "0" + 안내문 + 추천 검색어 chip + 보조 CTA.
 */

import Link from 'next/link';
import { ArrowIcon } from '../common/Icons';

const SUGGESTIONS = ['실리카겔', '새소년', 'hyukoh', '검정치마', '잔다리', '펜타포트'];

export function EmptyState({ query }: { query: string }) {
  return (
    <section className="mx-auto mt-16 max-w-[1400px] px-6 pb-24 sm:mt-24 sm:px-10">
      <div className="mx-auto max-w-2xl py-16 text-center sm:py-24">
        <div className="mb-10 inline-flex flex-col items-center">
          <div className="logo-headliner select-none text-[120px] leading-none tracking-[-0.02em] text-paper/15 sm:text-[160px]">
            0
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-[0.4em] text-paper/40">
            NO RESULTS
          </div>
        </div>

        <h2 className="text-[26px] font-bold tracking-[-0.025em] text-paper sm:text-[34px]">
          <span className="text-paper/50">&quot;</span>
          {query}
          <span className="text-paper/50">&quot;</span>
          <span className="text-paper/60"> 에 대한 결과가 없어요.</span>
        </h2>

        <p className="mt-5 text-[15px] leading-relaxed text-paper/55">
          철자를 확인하거나, 더 짧은 단어로 검색해보세요.
          <br className="hidden sm:block" />
          공연·페스티벌·아티스트 이름, 장소 이름으로 찾을 수 있어요.
        </p>

        <div className="mt-12">
          <div className="mb-4 text-[11px] uppercase tracking-[0.3em] text-paper/40">
            자주 찾는 검색어
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <Link
                key={s}
                href={`/?q=${encodeURIComponent(s)}`}
                className="h-9 rounded-full border border-white/10 px-3.5 text-[13px] text-paper/80 transition hover:border-white/30 hover:text-paper"
              >
                <span className="inline-flex h-full items-center">{s}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6 text-[12px] uppercase tracking-[0.18em] text-paper/55">
          <Link
            href="/"
            className="group flex items-center gap-2 transition hover:text-paper"
          >
            오늘의 공연 둘러보기
            <ArrowIcon className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
