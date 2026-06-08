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
import { getAllShows, mapShowToItem } from '../../lib/listings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '전체 공연 · HEADLINER',
};

export default async function ShowsListPage() {
  const rows = await getAllShows();
  const items = rows.map(mapShowToItem);

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-12 sm:px-10 sm:pt-16">
          <BackLink fallbackHref="/" />
        </section>
        <ShowsGrid
          items={items}
          title="전체 공연"
          sortable
          emptyLabel="등록된 공연이 없습니다."
        />
      </main>
    </div>
  );
}
