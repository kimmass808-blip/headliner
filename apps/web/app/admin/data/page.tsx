/**
 * /admin/data — 데이터 관리.
 *
 * 검수를 마친(APPROVED/REJECTED) 데이터를 검색·필터·정렬하고, 인라인 수정 또는
 * hard delete 한다. APPROVED 만 공개 사이트에 노출된다.
 */

import {
  loadArtistSuggest,
  loadFestivalOptions,
  loadManaged,
} from '../../../components/admin/loaders';
import { DataTable } from '../../../components/admin/DataTable';

export const dynamic = 'force-dynamic';

export default async function AdminDataPage() {
  const [rows, festivalOptions, artistSuggest] = await Promise.all([
    loadManaged(),
    loadFestivalOptions(),
    loadArtistSuggest(),
  ]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[16px] font-bold text-zinc-900">데이터 관리</h1>
          <span className="text-[13px] text-zinc-400">승인 완료된 공개 데이터</span>
        </div>
      </header>
      <DataTable initialRows={rows} festivalOptions={festivalOptions} artistSuggest={artistSuggest} />
    </>
  );
}
