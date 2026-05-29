'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Button, Field, IconButton, Poster, TextInput, TypeBadge, inputCls } from './ui';
import type { FestivalOption, FestivalVM, ItemVM, SessionVM, ShowVM } from './types';

// ── 아티스트 칩 에디터 ───────────────────────────────────
function ArtistEditor({
  value,
  onChange,
  suggest,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggest: string[];
}) {
  const [input, setInput] = useState('');
  const add = (name: string) => {
    const n = name.trim();
    if (n && !value.includes(n)) onChange([...value, n]);
    setInput('');
  };
  const filtered = input ? suggest.filter((s) => s.includes(input) && !value.includes(s)).slice(0, 4) : [];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-1 pl-2.5 pr-1 text-[12px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
          >
            {a}
            <button
              onClick={() => onChange(value.filter((x) => x !== a))}
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            >
              <Icon name="x" size={11} strokeWidth={2.2} />
            </button>
          </span>
        ))}
        {!value.length && <span className="py-1 text-[12px] text-amber-600">아티스트가 비어 있습니다</span>}
      </div>
      <div className="relative mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder="아티스트 추가 후 Enter"
          className={inputCls}
        />
        {filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
            {filtered.map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                className="block w-full px-3 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-blue-50 hover:text-blue-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 세션(공연 날짜) 에디터 ───────────────────────────────
function SessionEditor({ value, onChange }: { value: SessionVM[]; onChange: (next: SessionVM[]) => void }) {
  const upd = (i: number, key: keyof SessionVM, v: string) => {
    onChange(value.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));
  };
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={s.date}
            onChange={(e) => upd(i, 'date', e.target.value)}
            placeholder="YYYY.MM.DD"
            className={`${inputCls} font-mono`}
          />
          <input
            value={s.day}
            onChange={(e) => upd(i, 'day', e.target.value.toUpperCase())}
            placeholder="요일"
            className={`${inputCls} w-20 text-center font-mono uppercase`}
          />
          <button
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      ))}
      {!value.length && <p className="text-[12px] text-amber-600">등록된 날짜가 없습니다</p>}
      <button
        onClick={() => onChange([...value, { date: '', day: '' }])}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700"
      >
        <Icon name="plus" size={13} strokeWidth={2} /> 날짜 추가
      </button>
    </div>
  );
}

export function EditDrawer({
  item,
  onClose,
  onSave,
  onSaveApprove,
  onReject,
  onDelete,
  festivalOptions,
  artistSuggest,
}: {
  item: ItemVM;
  onClose: () => void;
  onSave: (draft: ItemVM) => void;
  onSaveApprove: (draft: ItemVM) => void;
  onReject: (draft: ItemVM) => void;
  onDelete: (draft: ItemVM) => void;
  festivalOptions: FestivalOption[];
  artistSuggest: string[];
}) {
  const [draft, setDraft] = useState<ItemVM>(item);
  useEffect(() => {
    setDraft(item);
  }, [item]);

  const isFest = draft.type === 'FESTIVAL';
  const show = draft as ShowVM;
  const fest = draft as FestivalVM;

  const setShow = <K extends keyof ShowVM>(key: K, v: ShowVM[K]) =>
    setDraft((d) => ({ ...(d as ShowVM), [key]: v }));
  const setFest = <K extends keyof FestivalVM>(key: K, v: FestivalVM[K]) =>
    setDraft((d) => ({ ...(d as FestivalVM), [key]: v }));

  const missingArtists = !isFest && !show.artists.length;
  const missingDates = !isFest && !show.sessions.length;
  const missingLoc = isFest && !fest.location;

  return (
    <aside className="flex w-[460px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={draft.type} />
          <span className="font-mono text-[12px] text-zinc-400">{draft.id}</span>
        </div>
        <IconButton icon="x" title="닫기 (Esc)" onClick={onClose} />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {draft.dupOf && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800 ring-1 ring-inset ring-blue-600/15">
            <Icon name="layers" size={15} className="mt-0.5 shrink-0 text-blue-500" />
            <span>
              <b className="font-mono">{draft.dupOf}</b> 와(과) 중복 후보입니다. 병합하거나 거절하세요.
            </span>
          </div>
        )}

        <Field label="포스터">
          <div className="flex gap-3">
            <Poster src={draft.poster} className="h-28 w-[84px] shrink-0 rounded-md ring-1 ring-zinc-200" label="없음" />
            <div className="flex flex-col justify-center gap-2">
              <span className="font-mono text-[11px] text-zinc-400">3:4 권장</span>
              {draft.poster && (
                <button
                  onClick={() => (isFest ? setFest('poster', null) : setShow('poster', null))}
                  className="text-left text-[12px] text-red-500 hover:text-red-600"
                >
                  제거
                </button>
              )}
            </div>
          </div>
        </Field>

        {isFest ? (
          <>
            <Field label="페스티벌 이름">
              <TextInput value={fest.name} onChange={(e) => setFest('name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작일">
                <TextInput
                  value={fest.startDate}
                  onChange={(e) => setFest('startDate', e.target.value)}
                  placeholder="YYYY.MM.DD"
                  className="font-mono"
                />
              </Field>
              <Field label="종료일" missing={!fest.endDate}>
                <TextInput
                  value={fest.endDate}
                  onChange={(e) => setFest('endDate', e.target.value)}
                  placeholder="YYYY.MM.DD"
                  className="font-mono"
                />
              </Field>
            </div>
            <Field label="위치" missing={missingLoc}>
              <TextInput value={fest.location} onChange={(e) => setFest('location', e.target.value)} placeholder="장소명" />
            </Field>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-[12px] text-zinc-500">
              연결된 공연 <b className="tabular-nums text-zinc-700">{fest.linkedShows}</b>건 · 공연 연결은 각 Show
              편집에서 관리합니다.
            </div>
          </>
        ) : (
          <>
            <Field label="제목" missing={!show.title}>
              <TextInput value={show.title} onChange={(e) => setShow('title', e.target.value)} placeholder="공연 제목" />
            </Field>
            <Field label="아티스트" missing={missingArtists} hint="여러 명 가능">
              <ArtistEditor value={show.artists} onChange={(v) => setShow('artists', v)} suggest={artistSuggest} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="공연장" missing={!show.venue}>
                <TextInput value={show.venue} onChange={(e) => setShow('venue', e.target.value)} placeholder="공연장명" />
              </Field>
              <Field label="지역" missing={!show.city}>
                <TextInput value={show.city} onChange={(e) => setShow('city', e.target.value)} placeholder="시 / 구" />
              </Field>
            </div>
            <Field label="세션 날짜" missing={missingDates}>
              <SessionEditor value={show.sessions} onChange={(v) => setShow('sessions', v)} />
            </Field>
            <Field label="소속 페스티벌" hint="없으면 단독 공연">
              <div className="relative">
                <select
                  value={show.festivalId || ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const name = festivalOptions.find((f) => f.id === id)?.name ?? null;
                    setDraft((d) => ({ ...(d as ShowVM), festivalId: id, festival: name }));
                  }}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  <option value="">— 없음 (단독) —</option>
                  {festivalOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevDown"
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
              </div>
            </Field>
          </>
        )}

        <Field label="원본 출처">
          <a
            href={draft.igUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <span className="flex items-center gap-2 text-[13px]">
              <Icon name="link" size={14} className="text-zinc-400" />
              <span className="truncate font-mono text-zinc-600">{draft.igHandle || draft.igUrl}</span>
            </span>
            <Icon name="external" size={14} className="shrink-0 text-blue-600" />
          </a>
        </Field>
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Button variant="approve" icon="check" className="flex-1" onClick={() => onSaveApprove(draft)}>
            저장 후 승인
          </Button>
          <Button variant="default" onClick={() => onSave(draft)}>
            저장
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => onReject(draft)} className="text-[12px] font-medium text-red-600 hover:text-red-700">
            거절…
          </button>
          <button
            onClick={() => onDelete(draft)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-400 hover:text-red-600"
          >
            <Icon name="trash" size={13} /> 삭제
          </button>
        </div>
      </div>
    </aside>
  );
}

export function RejectModal({
  item,
  onCancel,
  onConfirm,
}: {
  item: { title?: string; name?: string } | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const presets = ['공연 정보 아님', '중복 게시물', '정보 부족 / 확인 불가', '취소된 공연'];
  useEffect(() => {
    if (item) setReason('');
  }, [item]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl ring-1 ring-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-zinc-900">거절 사유</h3>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          {item.title || item.name || '(제목 없음)'} 항목을 거절합니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset transition ${
                reason === p
                  ? 'bg-red-600 text-white ring-red-600'
                  : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="상세 사유 (선택)"
          className={`${inputCls} mt-3 resize-none`}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="default" onClick={onCancel}>
            취소
          </Button>
          <Button
            variant="primary"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-600"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
          >
            거절 확정
          </Button>
        </div>
      </div>
    </div>
  );
}
