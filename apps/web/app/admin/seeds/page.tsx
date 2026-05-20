/**
 * AC-14 — SeedAccount 관리.
 * 리스트 + 필터(status, kind, addedBy) + status 일괄 변경.
 * AC-6f: pending → active/rejected 일괄.
 */

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { prisma } from '@mft/db';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  kind?: string;
  addedBy?: string;
}

async function changeStatus(formData: FormData) {
  'use server';
  const handle = formData.get('handle')?.toString();
  const newStatus = formData.get('newStatus')?.toString();
  if (!handle || !newStatus) return;
  if (!['pending', 'active', 'rejected', 'dead'].includes(newStatus)) return;
  await prisma.seedAccount.update({
    where: { igHandle: handle },
    data: {
      status: newStatus,
      ...(newStatus === 'active' ? { promotedAt: new Date() } : {}),
    },
  });
  revalidatePath('/admin/seeds');
}

async function addSeed(formData: FormData) {
  'use server';
  const handle = formData.get('handle')?.toString().trim().replace(/^@/, '');
  const kind = (formData.get('kind')?.toString() || 'festival') as 'festival' | 'artist' | 'venue';
  if (!handle) return;
  await prisma.seedAccount.upsert({
    where: { igHandle: handle },
    create: {
      igHandle: handle,
      kind,
      status: 'active', // 운영자가 직접 추가하면 active로 바로 진입
      addedBy: 'operator',
    },
    update: {
      // 이미 존재하면 active로 부활 (예전에 rejected였더라도 운영자 재확신)
      status: 'active',
      removedAt: null,
    },
  });
  revalidatePath('/admin/seeds');
}

export default async function AdminSeedsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, kind, addedBy } = await searchParams;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (kind) where.kind = kind;
  if (addedBy) where.addedBy = addedBy;

  const seeds = await prisma.seedAccount.findMany({
    where,
    orderBy: [{ status: 'asc' }, { lastFetched: 'desc' }],
    take: 200,
  });

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Admin Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold">시드 IG 계정</h1>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">새 시드 추가</h2>
        <form action={addSeed} className="mt-3 flex gap-2">
          <input
            name="handle"
            placeholder="@handle (예: grandmint_festival)"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <select
            name="kind"
            defaultValue="festival"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="festival">festival</option>
            <option value="artist">artist</option>
            <option value="venue">venue</option>
          </select>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            추가
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          페스티벌 IG 5-10개를 시드로 입력하면, 라인업 게시물에서 발견된 아티스트 IG가 자동으로
          pending 큐에 추가됩니다 (snowball, depth=1).
        </p>
      </section>

      <section className="mt-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">필터:</span>
          {[
            ['status', undefined, '전체'],
            ['status', 'pending', 'pending'],
            ['status', 'active', 'active'],
            ['status', 'dead', 'dead'],
            ['status', 'rejected', 'rejected'],
          ].map(([key, value, label]) => {
            const isActive = (status ?? undefined) === (value ?? undefined);
            const href = value ? `/admin/seeds?${key}=${value}` : '/admin/seeds';
            return (
              <Link
                key={String(value ?? 'all')}
                href={href}
                className={
                  isActive
                    ? 'rounded bg-zinc-900 px-2 py-1 text-white'
                    : 'rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100'
                }
              >
                {label}
              </Link>
            );
          })}
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-2">@handle</th>
              <th>kind</th>
              <th>status</th>
              <th>added</th>
              <th>fails</th>
              <th>action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {seeds.map((s) => (
              <tr key={s.igHandle}>
                <td className="py-2 font-mono text-xs">@{s.igHandle}</td>
                <td className="text-xs">{s.kind}</td>
                <td className="text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      s.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : s.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : s.status === 'dead'
                        ? 'bg-zinc-100 text-zinc-600'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="text-xs">
                  {s.addedBy}
                  {s.sourceSeedHandle ? (
                    <span className="ml-1 text-zinc-400">← @{s.sourceSeedHandle}</span>
                  ) : null}
                </td>
                <td className="text-xs">{s.consecutiveFails}</td>
                <td>
                  <form action={changeStatus} className="flex gap-1">
                    <input type="hidden" name="handle" value={s.igHandle} />
                    {s.status === 'pending' ? (
                      <>
                        <button
                          name="newStatus"
                          value="active"
                          className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700"
                        >
                          승급
                        </button>
                        <button
                          name="newStatus"
                          value="rejected"
                          className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                        >
                          거부
                        </button>
                      </>
                    ) : s.status === 'active' ? (
                      <button
                        name="newStatus"
                        value="rejected"
                        className="rounded bg-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-400"
                      >
                        제거
                      </button>
                    ) : (
                      <button
                        name="newStatus"
                        value="active"
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                      >
                        부활
                      </button>
                    )}
                  </form>
                </td>
              </tr>
            ))}
            {seeds.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-400">
                  시드가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
