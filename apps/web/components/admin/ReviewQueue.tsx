'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { Button, Checkbox, CompletenessDots, EmptyState, IconButton, Kbd, Poster } from './ui';
import { EditDrawer, RejectModal } from './EditDrawer';
import { useToast } from './AdminShell';
import {
  approveFestival,
  approveFestivalInfo,
  approveShow,
  deleteFestival,
  deleteFestivalInfo,
  deleteShow,
  rejectFestival,
  rejectFestivalInfo,
  rejectShow,
  saveFestival,
  saveFestivalAndApprove,
  saveShow,
  saveShowAndApprove,
  setFestivalInfoCategory,
} from '../../app/admin/actions';
import type {
  FestivalInfoCategory,
  FestivalInfoVM,
  FestivalOption,
  FestivalVM,
  ItemVM,
  ShowVM,
} from './types';

function festCompleteness(f: FestivalVM): number {
  return 3 - Math.min(3, f.missing.length);
}

// 관람 정보 카테고리 — 운영자 보정용 셀렉트 옵션 (8종).
const INFO_CATEGORIES: { value: FestivalInfoCategory; label: string }[] = [
  { value: 'MAP', label: '사이트맵·배치도' },
  { value: 'TIMETABLE', label: '타임테이블' },
  { value: 'ACCESS', label: '교통·주차' },
  { value: 'RULES', label: '입장·반입 규정' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'GOODS', label: 'MD·푸드' },
  { value: 'AMENITY', label: '편의시설' },
  { value: 'NOTICE', label: '안내' },
];

function infoCategoryLabel(c: FestivalInfoCategory): string {
  return INFO_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

// ── FestivalInfo 행 — 카테고리 보정 셀렉트 + 승인/거절/삭제 ──
function InfoRow({
  fi,
  focused,
  onApprove,
  onReject,
  onDelete,
  onChangeCategory,
}: {
  fi: FestivalInfoVM;
  focused: boolean;
  onApprove: (x: FestivalInfoVM) => void;
  onReject: (x: FestivalInfoVM) => void;
  onDelete: (x: FestivalInfoVM) => void;
  onChangeCategory: (x: FestivalInfoVM, c: FestivalInfoCategory) => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 transition ${
        focused ? 'bg-zinc-50' : 'hover:bg-zinc-50/70'
      }`}
    >
      <Poster src={fi.imageUrls[0] ?? null} className="h-[52px] w-10 shrink-0 rounded ring-1 ring-zinc-200" label="—" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-zinc-900">
            {fi.title || <span className="text-zinc-400">(제목 없음)</span>}
          </span>
          {fi.imageUrls.length > 1 && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">
              {fi.imageUrls.length}장
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-zinc-500">{fi.festivalName || '—'}</div>
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <select
          value={fi.category}
          onChange={(e) => onChangeCategory(fi, e.target.value as FestivalInfoCategory)}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-700"
          title="카테고리 보정"
        >
          {INFO_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <IconButton icon="check" title="승인 (A)" variant="approve" onClick={() => onApprove(fi)} />
        <IconButton icon="x" title="거절 (R)" variant="danger" onClick={() => onReject(fi)} />
        <IconButton icon="trash" title="삭제 (D)" variant="danger" onClick={() => onDelete(fi)} />
      </div>
    </div>
  );
}

// ── Show 행 ──────────────────────────────────────────────
function ShowRow({
  s,
  selected,
  focused,
  compact,
  checked,
  onToggleCheck,
  onSelect,
  onApprove,
  onReject,
  onDelete,
}: {
  s: ShowVM;
  selected: boolean;
  focused: boolean;
  compact: boolean;
  checked: boolean;
  onToggleCheck: (id: string) => void;
  onSelect: (x: ItemVM) => void;
  onApprove: (x: ItemVM) => void;
  onReject: (x: ItemVM) => void;
  onDelete: (x: ItemVM) => void;
}) {
  const c = s.completeness;
  return (
    <div
      onClick={() => onSelect(s)}
      className={`group flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-2.5 transition ${
        selected
          ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200'
          : checked
          ? 'bg-blue-50/40'
          : focused
          ? 'bg-zinc-50'
          : 'hover:bg-zinc-50/70'
      }`}
    >
      <Checkbox checked={checked} onChange={() => onToggleCheck(s.id)} title="선택" />
      <Poster src={s.poster} className="h-[52px] w-10 shrink-0 rounded ring-1 ring-zinc-200" label="—" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-zinc-900">
            {s.title || <span className="text-amber-600">(제목 없음)</span>}
          </span>
          {s.dupOf && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
              <Icon name="layers" size={10} />
              중복?
            </span>
          )}
          {compact && (
            <span className="shrink-0">
              <CompletenessDots value={c} />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-zinc-500">
          <span className="truncate font-medium text-zinc-600">{s.artists.length ? s.artists.join(', ') : '—'}</span>
          {!compact && s.festival && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-zinc-400">
              <span className="text-zinc-300">·</span>
              <Icon name="layers" size={11} />
              {s.festival.replace(/^\d+\s/, '')}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <>
          <div className="hidden w-44 shrink-0 text-[12px] text-zinc-500 lg:block">
            {s.venue ? <div className="truncate">{s.venue}</div> : <div className="text-amber-600">공연장 없음</div>}
            <div className="truncate text-zinc-400">{s.city || '—'}</div>
          </div>
          <div className="hidden w-28 shrink-0 font-mono text-[12px] text-zinc-500 md:block">
            {s.sessions.length ? (
              <>
                <div className="text-zinc-700">{s.sessions[0].date}</div>
                {s.sessions.length > 1 && <div className="text-zinc-400">+{s.sessions.length - 1} 회차</div>}
              </>
            ) : (
              <span className="font-sans text-amber-600">날짜 없음</span>
            )}
          </div>
          <div className="hidden w-9 shrink-0 justify-center xl:flex">
            <CompletenessDots value={c} />
          </div>
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconButton icon="check" title="승인 (A)" variant="approve" onClick={() => onApprove(s)} />
            <IconButton icon="x" title="거절 (R)" variant="danger" onClick={() => onReject(s)} />
            <IconButton icon="pencil" title="수정 (E)" variant="blue" onClick={() => onSelect(s)} />
            <IconButton icon="trash" title="삭제 (D)" variant="danger" onClick={() => onDelete(s)} />
          </div>
        </>
      )}
      {compact && (
        <Icon name="chevRight" size={15} className={`shrink-0 ${selected ? 'text-blue-500' : 'text-zinc-300'}`} />
      )}
    </div>
  );
}

// ── Festival 행 ─────────────────────────────────────────
function FestRow({
  f,
  selected,
  focused,
  compact,
  checked,
  onToggleCheck,
  onSelect,
  onApprove,
  onReject,
  onDelete,
}: {
  f: FestivalVM;
  selected: boolean;
  focused: boolean;
  compact: boolean;
  checked: boolean;
  onToggleCheck: (id: string) => void;
  onSelect: (x: ItemVM) => void;
  onApprove: (x: ItemVM) => void;
  onReject: (x: ItemVM) => void;
  onDelete: (x: ItemVM) => void;
}) {
  const c = festCompleteness(f);
  return (
    <div
      onClick={() => onSelect(f)}
      className={`group flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-2.5 transition ${
        selected
          ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200'
          : checked
          ? 'bg-blue-50/40'
          : focused
          ? 'bg-zinc-50'
          : 'hover:bg-zinc-50/70'
      }`}
    >
      <Checkbox checked={checked} onChange={() => onToggleCheck(f.id)} title="선택" />
      <Poster src={f.poster} className="h-[52px] w-10 shrink-0 rounded ring-1 ring-zinc-200" label="—" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-zinc-900">{f.name}</span>
          {compact && (
            <span className="shrink-0">
              <CompletenessDots value={c} />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-zinc-500">
          {f.location ? <span className="truncate">{f.location}</span> : <span className="text-amber-600">위치 없음</span>}
          <span className="text-zinc-300">·</span>
          <span className="shrink-0 text-zinc-400">{f.city || '지역 미정'}</span>
        </div>
      </div>
      {!compact && (
        <>
          <div className="hidden w-40 shrink-0 font-mono text-[12px] text-zinc-600 md:block">
            {f.startDate}
            <span className="text-zinc-300"> – </span>
            {f.endDate || <span className="font-sans text-amber-600">미정</span>}
          </div>
          <div className="hidden w-20 shrink-0 text-[12px] text-zinc-500 lg:block">
            <span className="font-semibold tabular-nums text-zinc-700">{f.linkedShows}</span> 공연
          </div>
          <div className="hidden w-9 shrink-0 justify-center xl:flex">
            <CompletenessDots value={c} />
          </div>
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconButton icon="check" title="승인 (A)" variant="approve" onClick={() => onApprove(f)} />
            <IconButton icon="x" title="거절 (R)" variant="danger" onClick={() => onReject(f)} />
            <IconButton icon="pencil" title="수정 (E)" variant="blue" onClick={() => onSelect(f)} />
            <IconButton icon="trash" title="삭제 (D)" variant="danger" onClick={() => onDelete(f)} />
          </div>
        </>
      )}
      {compact && (
        <Icon name="chevRight" size={15} className={`shrink-0 ${selected ? 'text-blue-500' : 'text-zinc-300'}`} />
      )}
    </div>
  );
}

function Tab({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-3 pb-2 pt-1 text-[14px] font-semibold transition ${
        active ? 'border-blue-600 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
          active ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-400'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function ReviewQueue({
  initialShows,
  initialFestivals,
  initialInfos,
  festivalOptions,
  artistSuggest,
}: {
  initialShows: ShowVM[];
  initialFestivals: FestivalVM[];
  initialInfos: FestivalInfoVM[];
  festivalOptions: FestivalOption[];
  artistSuggest: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [tab, setTab] = useState<'SHOW' | 'FESTIVAL' | 'INFO'>('SHOW');
  const [shows, setShows] = useState<ShowVM[]>(initialShows);
  const [fests, setFests] = useState<FestivalVM[]>(initialFestivals);
  const [infos, setInfos] = useState<FestivalInfoVM[]>(initialInfos);
  const [selId, setSelId] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<ItemVM | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkReject, setBulkReject] = useState(false);

  useEffect(() => setShows(initialShows), [initialShows]);
  useEffect(() => setFests(initialFestivals), [initialFestivals]);
  useEffect(() => setInfos(initialInfos), [initialInfos]);

  const list: ItemVM[] = tab === 'SHOW' ? shows : tab === 'FESTIVAL' ? fests : [];
  const selected = [...shows, ...fests].find((x) => x.id === selId) || null;
  const drawerOpen = !!selected;

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

  const toggleCheck = (id: string) =>
    setChecked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearChecked = () => setChecked(new Set());
  const allChecked = list.length > 0 && list.every((x) => checked.has(x.id));
  const someChecked = list.some((x) => checked.has(x.id));
  const toggleAll = () =>
    setChecked((p) => {
      const n = new Set(p);
      if (allChecked) list.forEach((x) => n.delete(x.id));
      else list.forEach((x) => n.add(x.id));
      return n;
    });
  const checkedInTab = list.filter((x) => checked.has(x.id));

  // optimistic local removal
  const removeLocal = (id: string) => {
    setShows((p) => p.filter((x) => x.id !== id));
    setFests((p) => p.filter((x) => x.id !== id));
    setChecked((p) => {
      if (!p.has(id)) return p;
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    if (selId === id) setSelId(null);
  };

  const approve = (item: ItemVM) => {
    removeLocal(item.id);
    const label = item.type === 'SHOW' ? item.title : item.name;
    run(
      () => (item.type === 'SHOW' ? approveShow(item.id) : approveFestival(item.id)),
      `승인됨 · ${label || item.id} → 사이트 공개`,
    );
  };
  const del = (item: ItemVM) => {
    removeLocal(item.id);
    run(() => (item.type === 'SHOW' ? deleteShow(item.id) : deleteFestival(item.id)), `삭제됨 · ${item.id}`);
  };
  const doReject = (reason: string) => {
    const item = rejectTarget;
    if (!item) return;
    removeLocal(item.id);
    const label = item.type === 'SHOW' ? item.title : item.name;
    run(
      () => (item.type === 'SHOW' ? rejectShow(item.id, reason) : rejectFestival(item.id, reason)),
      `거절됨 · ${label || item.id}`,
    );
    setRejectTarget(null);
  };

  // ── FestivalInfo 핸들러 (카테고리 보정 + 승인/거절/삭제) ──
  const removeInfoLocal = (id: string) => {
    setInfos((p) => p.filter((x) => x.id !== id));
  };
  const approveInfo = (item: FestivalInfoVM) => {
    removeInfoLocal(item.id);
    run(() => approveFestivalInfo(item.id), `승인됨 · ${item.title || item.id} → 사이트 공개`);
  };
  const delInfo = (item: FestivalInfoVM) => {
    removeInfoLocal(item.id);
    run(() => deleteFestivalInfo(item.id), `삭제됨 · ${item.id}`);
  };
  const rejectInfo = (item: FestivalInfoVM) => {
    removeInfoLocal(item.id);
    run(() => rejectFestivalInfo(item.id, null), `거절됨 · ${item.title || item.id}`);
  };
  const changeInfoCategory = (item: FestivalInfoVM, category: FestivalInfoCategory) => {
    setInfos((p) => p.map((x) => (x.id === item.id ? { ...x, category } : x)));
    run(() => setFestivalInfoCategory(item.id, category), `카테고리 변경 · ${infoCategoryLabel(category)}`);
  };

  const bulkRemoveLocal = (ids: string[]) => {
    const idset = new Set(ids);
    setShows((p) => p.filter((x) => !idset.has(x.id)));
    setFests((p) => p.filter((x) => !idset.has(x.id)));
    if (selId && idset.has(selId)) setSelId(null);
    clearChecked();
  };
  const bulkApprove = () => {
    const items = [...checkedInTab];
    if (!items.length) return;
    bulkRemoveLocal(items.map((x) => x.id));
    run(
      () => Promise.all(items.map((x) => (x.type === 'SHOW' ? approveShow(x.id) : approveFestival(x.id)))).then(() => {}),
      `${items.length}건 승인됨 → 사이트 공개`,
    );
  };
  const bulkDelete = () => {
    const items = [...checkedInTab];
    if (!items.length) return;
    bulkRemoveLocal(items.map((x) => x.id));
    run(
      () => Promise.all(items.map((x) => (x.type === 'SHOW' ? deleteShow(x.id) : deleteFestival(x.id)))).then(() => {}),
      `${items.length}건 삭제됨`,
    );
  };
  const doBulkReject = (reason: string) => {
    const items = [...checkedInTab];
    if (!items.length) return;
    bulkRemoveLocal(items.map((x) => x.id));
    run(
      () =>
        Promise.all(
          items.map((x) => (x.type === 'SHOW' ? rejectShow(x.id, reason) : rejectFestival(x.id, reason))),
        ).then(() => {}),
      `${items.length}건 거절됨`,
    );
    setBulkReject(false);
  };

  // edit save
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
    if (draft.type === 'SHOW') setShows((p) => p.map((x) => (x.id === draft.id ? draft : x)));
    else setFests((p) => p.map((x) => (x.id === draft.id ? draft : x)));
    run(
      () => (draft.type === 'SHOW' ? saveShow(toShowPayload(draft)) : saveFestival(toFestPayload(draft))),
      `저장됨 · ${draft.id}`,
    );
  };
  const saveApprove = (draft: ItemVM) => {
    removeLocal(draft.id);
    run(
      () =>
        draft.type === 'SHOW'
          ? saveShowAndApprove(toShowPayload(draft))
          : saveFestivalAndApprove(toFestPayload(draft)),
      `저장 후 승인됨 · ${draft.id} → 사이트 공개`,
    );
  };

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rejectTarget || bulkReject) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() || '';
      if (['input', 'textarea', 'select'].includes(tag)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      const cur = list[focusIdx];
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(list.length - 1, i + 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
      } else if ((e.key === 'x' || e.key === ' ') && cur) {
        e.preventDefault();
        toggleCheck(cur.id);
      } else if (e.key === 'Enter' && cur) {
        e.preventDefault();
        setSelId(cur.id);
      } else if (e.key === 'Escape') {
        if (someChecked) clearChecked();
        else setSelId(null);
      } else if (e.key === 'a') {
        if (someChecked) bulkApprove();
        else if (cur) approve(cur);
      } else if (e.key === 'r') {
        if (someChecked) setBulkReject(true);
        else if (cur) setRejectTarget(cur);
      } else if (e.key === 'e' && cur) {
        setSelId(cur.id);
      } else if (e.key === 'd') {
        if (someChecked) bulkDelete();
        else if (cur) del(cur);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, focusIdx, rejectTarget, bulkReject, checked]);

  useEffect(() => {
    setFocusIdx(0);
    clearChecked();
  }, [tab]);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 pt-3">
          <div className="flex gap-1">
            <Tab active={tab === 'SHOW'} count={shows.length} onClick={() => setTab('SHOW')}>
              Show
            </Tab>
            <Tab active={tab === 'FESTIVAL'} count={fests.length} onClick={() => setTab('FESTIVAL')}>
              Festival
            </Tab>
            <Tab active={tab === 'INFO'} count={infos.length} onClick={() => setTab('INFO')}>
              관람정보
            </Tab>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-zinc-400 xl:flex">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd> 이동 <Kbd>X</Kbd> 선택 <Kbd>A</Kbd> 승인 <Kbd>R</Kbd> 거절 <Kbd>D</Kbd> 삭제
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <span className="flex w-[18px] shrink-0 items-center justify-center">
            <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} title="전체 선택" />
          </span>
          <span className="w-10 shrink-0" />
          <span className="flex-1 truncate">
            {tab === 'SHOW' ? '제목 · 아티스트' : tab === 'INFO' ? '관람정보 · 페스티벌' : '페스티벌 · 위치'}
          </span>
          {!drawerOpen && tab === 'INFO' && (
            <>
              <span className="hidden w-40 shrink-0 md:block">카테고리</span>
              <span className="w-[112px] shrink-0 text-right">액션</span>
            </>
          )}
          {!drawerOpen && tab !== 'INFO' && (
            <>
              {tab === 'SHOW' ? <span className="hidden w-44 shrink-0 lg:block">공연장</span> : null}
              <span className="hidden w-28 shrink-0 md:block lg:w-40">{tab === 'SHOW' ? '날짜' : '기간'}</span>
              {tab === 'FESTIVAL' && <span className="hidden w-20 shrink-0 lg:block">연결</span>}
              <span className="hidden w-9 shrink-0 text-center xl:block">완성</span>
              <span className="w-[136px] shrink-0 text-right">액션</span>
            </>
          )}
          {drawerOpen && <span className="shrink-0">선택됨</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {tab === 'INFO' ? (
            infos.length === 0 ? (
              <EmptyState
                icon="check"
                title="검수 대기 항목이 없습니다"
                body="모든 관람정보 항목을 처리했습니다. 새 크롤이 들어오면 여기 표시됩니다."
              />
            ) : (
              infos.map((fi, i) => (
                <InfoRow
                  key={fi.id}
                  fi={fi}
                  focused={focusIdx === i}
                  onApprove={approveInfo}
                  onReject={rejectInfo}
                  onDelete={delInfo}
                  onChangeCategory={changeInfoCategory}
                />
              ))
            )
          ) : list.length === 0 ? (
            <EmptyState
              icon="check"
              title="검수 대기 항목이 없습니다"
              body={`모든 ${tab === 'SHOW' ? 'Show' : 'Festival'} 항목을 처리했습니다. 새 크롤이 들어오면 여기 표시됩니다.`}
            />
          ) : (
            list.map((item, i) =>
              item.type === 'SHOW' ? (
                <ShowRow
                  key={item.id}
                  s={item}
                  compact={drawerOpen}
                  checked={checked.has(item.id)}
                  onToggleCheck={toggleCheck}
                  selected={selId === item.id}
                  focused={focusIdx === i}
                  onSelect={(x) => setSelId(x.id)}
                  onApprove={approve}
                  onReject={setRejectTarget}
                  onDelete={del}
                />
              ) : (
                <FestRow
                  key={item.id}
                  f={item}
                  compact={drawerOpen}
                  checked={checked.has(item.id)}
                  onToggleCheck={toggleCheck}
                  selected={selId === item.id}
                  focused={focusIdx === i}
                  onSelect={(x) => setSelId(x.id)}
                  onApprove={approve}
                  onReject={setRejectTarget}
                  onDelete={del}
                />
              ),
            )
          )}
        </div>

        {checkedInTab.length > 0 && (
          <div className="flex items-center gap-3 border-t border-zinc-200 bg-white px-4 py-2.5">
            <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} title="전체 선택" />
            <span className="text-[13px] font-semibold text-zinc-700">
              <span className="tabular-nums text-blue-600">{checkedInTab.length}</span>건 선택됨
            </span>
            <button onClick={clearChecked} className="text-[12px] font-medium text-zinc-400 hover:text-zinc-700">
              선택 해제
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="danger" icon="trash" onClick={bulkDelete}>
                삭제
              </Button>
              <Button size="sm" variant="default" icon="x" onClick={() => setBulkReject(true)}>
                거절
              </Button>
              <Button size="sm" variant="approve" icon="checkAll" onClick={bulkApprove}>
                {checkedInTab.length}건 일괄 승인
              </Button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <EditDrawer
          item={selected}
          festivalOptions={festivalOptions}
          artistSuggest={artistSuggest}
          onClose={() => setSelId(null)}
          onSave={saveDraft}
          onSaveApprove={saveApprove}
          onReject={(d) => setRejectTarget(d)}
          onDelete={del}
        />
      )}

      <RejectModal item={rejectTarget} onCancel={() => setRejectTarget(null)} onConfirm={doReject} />
      <RejectModal
        item={bulkReject ? { title: `${checkedInTab.length}건 선택 항목` } : null}
        onCancel={() => setBulkReject(false)}
        onConfirm={doBulkReject}
      />
    </div>
  );
}
