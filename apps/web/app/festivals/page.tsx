/**
 * 전체 페스티벌 보기 — `/festivals`.
 *
 * 승인된 다가오는 페스티벌을 PosterCard 그리드로 표시.
 * 정렬 토글(날짜순/가나다순)은 ShowsGrid가 담당.
 */

import type { Metadata } from 'next';
import { HomeHeader } from '../../components/home/Header';
import { BackLink } from '../../components/common/BackLink';
import { ShowsGrid } from '../../components/common/ShowsGrid';
import { getAllFestivals, mapFestivalToItem } from '../../lib/listings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '전체 페스티벌 · HEADLINER',
};

export default async function FestivalsListPage() {
  const rows = await getAllFestivals();
  const items = rows.map(mapFestivalToItem);

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-10 sm:pt-16">
          <BackLink fallbackHref="/" />
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[36px]">
            전체 페스티벌
          </h1>
        </section>
        <ShowsGrid
          items={items}
          title="페스티벌"
          sortable
          emptyLabel="등록된 페스티벌이 없습니다."
        />
      </main>
    </div>
  );
}
