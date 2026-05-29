'use client';

// Admin console — 데이터 관리 테이블 (APPROVED/REJECTED 공개 데이터).
// Search/type/status filter + sortable columns, inline edit (EditDrawer) and
// hard delete wired to server actions.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { CompletenessDots, EmptyState, IconButton, Poster, StatusBadge, TypeBadge, inputCls } from './ui';
import { EditDrawer } from './EditDrawer';
import { useToast } from './AdminShell';
import {
  deleteFestival,
  deleteShow,
  saveFestival,
  saveFestivalAndApprove,
  saveShow,
  saveShowAndApprove,
} from '../../app/admin/actions';
import type { FestivalOption, FestivalVM, ItemVM, ShowVM } from './types';

type SortKey = 'name' | 'date' | 'completeness';

function getDate(r: ItemVM): string {
  return r.type === 'FESTIVAL' ? r.startDate : r.sessions[0]?.date ?? '';
}
function getName(r: ItemVM): string {
  return r.type === 'FESTIVAL' ? r.name : r.title;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition ${
            value === val
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  initialRows,
  festivalOptions,
  artistSuggest,
}: {
  initialRows: ItemVM[];
  festivalOptions: FestivalOption[];
  artistSuggest: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [rows, setRows] = useState<ItemVM[]>(initialRows);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SHOW' | 'FESTIVAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED'>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => setRows(initialRows), [initialRows]);

  const run = (fn: () => Promise<void>, msg: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast(msg);
      } catch {
        toast('오류 — 새로고침 후 다시 시도하세요');
      } finally {
        router.refresh();
      }
    });
  };

  const filtered = useMemo(() => {
    let out = rows.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (q) {
        const artists = r.type === 'SHOW' ? r.artists.join(' ') : '';
        const loc = r.type === 'SHOW' ? r.venue : r.location;
        const hay = `${getName(r)} ${artists} ${loc || ''} ${r.city || ''}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sort.key === 'name') {
        av = getName(a);
        bv = getName(b);
      } else if (sort.key === 'completeness') {
        av = a.completeness;
        bv = b.completeness;
      } else {
        av = getDate(a);
        bv = getDate(b);
      }
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === 'asc' ? r : -r;
    });
    return out;
  }, [rows, q, typeFilter, statusFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const del = (r: ItemVM) => {
    setRows((p) => p.filter((x) => x.id !== r.id));
    if (editId === r.id) setEditId(null);
    run(() => (r.type === 'SHOW' ? deleteShow(r.id) : deleteFestival(r.id)), `삭제됨 · ${r.id}`);
  };

  const toShowPayload = (d: ShowVM) => ({
    id: d.id,
    title: d.title,
    artists: d.artists,
    venue: d.venue,
    city: d.city,
    sessions: d.sessions.map((s) => ({ date: s.date })),
    festivalId: d.festivalId,
  });
  const toFestPayload = (d: FestivalVM) => ({
    id: d.id,
    name: d.name,
    startDate: d.startDate,
    endDate: d.endDate,
    location: d.location,
  });

  const saveDraft = (draft: ItemVM) => {
    setRows((p) => p.map((x) => (x.id === draft.id ? draft : x)));
    run(
      () => (draft.type === 'SHOW' ? saveShow(toShowPayload(draft)) : saveFestival(toFestPayload(draft))),
      `저장됨 · ${draft.id}`,
    );
  };
  const saveApprove = (draft: ItemVM) => {
    setRows((p) => p.map((x) => (x.id === draft.id ? { ...draft, status: 'APPROVED' } : x)));
    setEditId(null);
    run(
      () =>
        draft.type === 'SHOW'
          ? saveShowAndApprove(toShowPayload(draft))
          : saveFestivalAndApprove(toFestPayload(draft)),
      `저장 후 승인됨 · ${draft.id}`,
    );
  };

  const editing = rows.find((r) => r.id === editId) || null;

  const SortTh = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 font-semibold ${className || ''}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-zinc-700">
        {children}
        <Icon name="sort" size={11} className={sort.key === k ? 'text-blue-600' : 'text-zinc-300'} />
      </button>
    </th>
  );

  return (
    <div className="flex-1 overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 max-w-[1180px] flex-col px-8 py-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">데이터 관리</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              승인 완료된 공개 데이터 · <span className="font-medium tabular-nums text-zinc-700">{filtered.length}</span>건
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목, 아티스트, 공연장 검색…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <Segmented
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ['ALL', '전체'],
              ['SHOW', 'Show'],
              ['FESTIVAL', 'Festival'],
            ]}
          />
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              ['ALL', '전체'],
              ['APPROVED', '승인'],
              ['REJECTED', '거절'],
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white">
          {filtered.length === 0 ? (
            <EmptyState icon="search" title="결과가 없습니다" body="검색어나 필터를 조정해 보세요." />
          ) : (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[10px] uppercase tracking-wider text-zinc-400">
                  <th className="w-12 px-4 py-2 font-semibold">포스터</th>
                  <SortTh k="name">제목 / 이름</SortTh>
                  <th className="hidden px-3 py-2 font-semibold md:table-cell">공연장 / 위치</th>
                  <SortTh k="date" className="hidden lg:table-cell">날짜</SortTh>
                  <th className="px-3 py-2 font-semibold">상태</th>
                  <SortTh k="completeness" className="hidden text-center xl:table-cell">완성</SortTh>
                  <th className="px-3 py-2 text-right font-semibold">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="group hover:bg-zinc-50/70">
                    <td className="px-4 py-2">
                      <Poster src={r.poster} className="h-11 w-8 rounded ring-1 ring-zinc-200" label="—" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <TypeBadge type={r.type} />
                        <span className="font-medium text-zinc-900">
                          {getName(r) || <span className="text-zinc-400">(제목 없음)</span>}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-zinc-500">
                        {r.type === 'FESTIVAL'
                          ? `${r.linkedShows} 공연 연결`
                          : r.artists.length
                          ? r.artists.join(', ')
                          : '—'}
                        {r.rejectReason && <span className="ml-1 text-red-500"> · {r.rejectReason}</span>}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-zinc-500 md:table-cell">
                      <div>{(r.type === 'SHOW' ? r.venue : r.location) || '—'}</div>
                      <div className="text-[12px] text-zinc-400">{r.city || ''}</div>
                    </td>
                    <td className="hidden px-3 py-2 font-mono text-[12px] text-zinc-600 lg:table-cell">
                      {getDate(r) || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="hidden px-3 py-2 text-center xl:table-cell">
                      <CompletenessDots value={r.completeness} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton icon="pencil" title="수정" variant="blue" onClick={() => setEditId(r.id)} />
                        <IconButton icon="trash" title="삭제" variant="danger" onClick={() => del(r)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <EditDrawer
          item={editing}
          festivalOptions={festivalOptions}
          artistSuggest={artistSuggest}
          onClose={() => setEditId(null)}
          onSave={saveDraft}
          onSaveApprove={saveApprove}
          onReject={() => setEditId(null)}
          onDelete={del}
        />
      )}
    </div>
  );
}
