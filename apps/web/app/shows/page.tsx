/**
 * 전체 공연 보기 — `/shows`.
 *
 * 승인된 다가오는 단독공연을 PosterCard 그리드로 표시.
 * 정렬 토글(날짜순/가나다순)은 ShowsGrid가 담당.
 */

import type { Metadata } from 'next';
import { HomeHeader } from '../../components/home/Header';
import { BackLink } from '../../components/common/BackLink';
import { ShowsGrid } from '../../components/common/ShowsGrid';
import { getAllUpcomingShows, mapShowToItem } from '../../lib/listings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '전체 공연 · HEADLINER',
};

export default async function ShowsListPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rows = await getAllUpcomingShows(startOfToday.getTime());
  const items = rows.map(mapShowToItem);

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-10 sm:pt-16">
          <BackLink fallbackHref="/" />
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[36px]">
            전체 공연
          </h1>
        </section>
        <ShowsGrid
          items={items}
          title="공연"
          sortable
          emptyLabel="예정된 공연이 없습니다."
        />
      </main>
    </div>
  );
}
