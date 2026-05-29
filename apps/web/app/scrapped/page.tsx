/**
 * 스크랩 보관함 — /scrapped.
 *
 * 스크랩 데이터는 브라우저 localStorage에만 있으므로 본문은 클라이언트에서
 * 하이드레이트한다(ScrappedView). 이 서버 컴포넌트는 헤더 + 타이틀 셸만 담당.
 */

import type { Metadata } from 'next';
import { HomeHeader } from '../../components/home/Header';
import { ScrappedView } from '../../components/scrapped/ScrappedView';

export const metadata: Metadata = {
  title: '스크랩 · HEADLINER',
};

export default function ScrappedPage() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />

      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-10 sm:pt-16">
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            LIBRARY
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[36px]">
            스크랩 보관함
          </h1>
        </section>

        <ScrappedView />
      </main>
    </div>
  );
}
