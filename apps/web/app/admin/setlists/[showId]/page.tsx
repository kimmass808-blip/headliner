/**
 * AC-15 — 셋리스트 CRUD.
 * V1: 단순 form 기반 (order 숫자 입력, 앵콜 체크, cover_of 텍스트).
 * V1.1 권고: dnd-kit으로 드래그 reorder.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@mft/db';

export const dynamic = 'force-dynamic';

async function ensureSetlist(showId: string): Promise<string> {
  const existing = await prisma.setlist.findUnique({ where: { showId } });
  if (existing) return existing.id;
  const created = await prisma.setlist.create({
    data: { showId },
  });
  return created.id;
}

async function addSong(formData: FormData) {
  'use server';
  const showId = formData.get('showId')?.toString();
  if (!showId) return;
  const title = formData.get('title')?.toString().trim();
  if (!title) return;
  const order = parseInt(formData.get('order')?.toString() || '0', 10);
  const isEncore = formData.get('isEncore') === 'on';
  const coverOf = formData.get('coverOf')?.toString().trim() || null;

  const setlistId = await ensureSetlist(showId);
  await prisma.song.create({
    data: { setlistId, title, order: order || 1, isEncore, coverOf },
  });
  revalidatePath(`/admin/setlists/${showId}`);
}

async function deleteSong(formData: FormData) {
  'use server';
  const songId = formData.get('songId')?.toString();
  const showId = formData.get('showId')?.toString();
  if (!songId || !showId) return;
  await prisma.song.delete({ where: { id: songId } });
  revalidatePath(`/admin/setlists/${showId}`);
}

async function updateSong(formData: FormData) {
  'use server';
  const songId = formData.get('songId')?.toString();
  const showId = formData.get('showId')?.toString();
  if (!songId || !showId) return;
  await prisma.song.update({
    where: { id: songId },
    data: {
      title: formData.get('title')?.toString() || undefined,
      order: parseInt(formData.get('order')?.toString() || '0', 10) || undefined,
      isEncore: formData.get('isEncore') === 'on',
      coverOf: formData.get('coverOf')?.toString().trim() || null,
    },
  });
  revalidatePath(`/admin/setlists/${showId}`);
}

async function updateSourceNotes(formData: FormData) {
  'use server';
  const showId = formData.get('showId')?.toString();
  if (!showId) return;
  const sourceNotes = formData.get('sourceNotes')?.toString().trim() || null;
  const setlistId = await ensureSetlist(showId);
  await prisma.setlist.update({
    where: { id: setlistId },
    data: { sourceNotes },
  });
  revalidatePath(`/admin/setlists/${showId}`);
}

export default async function AdminSetlistPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      venue: true,
      artists: true,
      setlist: {
        include: { songs: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!show) notFound();

  const songs = show.setlist?.songs ?? [];
  const nextOrder = songs.length > 0 ? Math.max(...songs.map((s) => s.order)) + 1 : 1;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Admin Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold">셋리스트 입력</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {show.artists.map((a) => a.canonicalName).join(', ')}
        {show.firstSessionDate
          ? ` · ${new Date(show.firstSessionDate).toLocaleDateString('ko-KR')}${show.lastSessionDate && show.lastSessionDate.getTime() !== show.firstSessionDate.getTime() ? `~${new Date(show.lastSessionDate).toLocaleDateString('ko-KR')}` : ''}`
          : ''}
        {show.venue ? ` · ${show.venue.name}` : ''}
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Show ID: <code>{show.id}</code> · IG:
        <a
          href={show.originalPostUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-blue-600 hover:underline"
        >
          원문 →
        </a>
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">곡 목록</h2>
        <ol className="mt-2 space-y-1">
          {songs.map((song) => (
            <li key={song.id} className="rounded border border-zinc-200 p-2 text-sm">
              <form action={updateSong} className="flex items-center gap-2">
                <input type="hidden" name="songId" value={song.id} />
                <input type="hidden" name="showId" value={showId} />
                <input
                  name="order"
                  type="number"
                  defaultValue={song.order}
                  min={1}
                  className="w-12 rounded border border-zinc-200 px-1 py-0.5 text-center text-xs"
                />
                <input
                  name="title"
                  defaultValue={song.title}
                  className="flex-1 rounded border border-zinc-200 px-2 py-0.5"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    name="isEncore"
                    defaultChecked={song.isEncore}
                  />
                  앵콜
                </label>
                <input
                  name="coverOf"
                  defaultValue={song.coverOf ?? ''}
                  placeholder="cover of..."
                  className="w-32 rounded border border-zinc-200 px-2 py-0.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded bg-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-300"
                >
                  저장
                </button>
              </form>
              <form action={deleteSong} className="mt-1 inline">
                <input type="hidden" name="songId" value={song.id} />
                <input type="hidden" name="showId" value={showId} />
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline"
                >
                  삭제
                </button>
              </form>
            </li>
          ))}
          {songs.length === 0 ? (
            <p className="text-sm text-zinc-400">아직 곡이 없습니다.</p>
          ) : null}
        </ol>

        <form action={addSong} className="mt-4 flex items-end gap-2 rounded bg-zinc-50 p-3">
          <input type="hidden" name="showId" value={showId} />
          <div className="w-14">
            <label className="block text-xs text-zinc-500">#</label>
            <input
              name="order"
              type="number"
              defaultValue={nextOrder}
              min={1}
              className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-zinc-500">곡 제목</label>
            <input
              name="title"
              required
              className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">cover of</label>
            <input
              name="coverOf"
              className="mt-0.5 block w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="isEncore" />
            앵콜
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            추가
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">출처 메모</h2>
        <form action={updateSourceNotes} className="mt-2">
          <input type="hidden" name="showId" value={showId} />
          <textarea
            name="sourceNotes"
            defaultValue={show.setlist?.sourceNotes ?? ''}
            placeholder="YouTube 영상 URL, 팬 카페 글, 운영자 메모 등"
            rows={3}
            className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="mt-2 rounded bg-zinc-200 px-3 py-1 text-xs hover:bg-zinc-300"
          >
            메모 저장
          </button>
        </form>
      </section>
    </main>
  );
}
