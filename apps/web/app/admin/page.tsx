/**
 * Admin 홈 — 운영자 진입점.
 * 큐 사이즈·최근 CrawlRun 요약 + 빠른 링크.
 */

import Link from 'next/link';
import { prisma } from '@mft/db';

export const dynamic = 'force-dynamic';

async function loadDashboard() {
  const [
    pendingShows,
    pendingFestivals,
    duplicateCandidates,
    seedPending,
    seedActive,
    seedDead,
    latestRuns,
  ] = await Promise.all([
    prisma.show.count({ where: { needsReview: true, duplicateOfShowId: null } }),
    prisma.festival.count({ where: { needsReview: true } }),
    prisma.show.count({ where: { duplicateOfShowId: { not: null } } }),
    prisma.seedAccount.count({ where: { status: 'pending' } }),
    prisma.seedAccount.count({ where: { status: 'active' } }),
    prisma.seedAccount.count({ where: { status: 'dead' } }),
    prisma.crawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        accountsAttempted: true,
        accountsSucceeded: true,
        showsCreated: true,
        snowballAdded: true,
        durationMs: true,
      },
    }),
  ]);
  return {
    pendingShows,
    pendingFestivals,
    duplicateCandidates,
    seedPending,
    seedActive,
    seedDead,
    latestRuns,
  };
}

export default async function AdminHomePage() {
  const data = await loadDashboard();

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">MFT 운영자 콘솔</p>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/incomplete"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-400"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500">보완 큐</p>
          <p className="mt-1 text-2xl font-bold">{data.pendingShows + data.pendingFestivals}</p>
          <p className="mt-1 text-xs text-zinc-600">
            Show {data.pendingShows} · Festival {data.pendingFestivals}
          </p>
        </Link>
        <Link
          href="/admin/incomplete?tab=duplicates"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-400"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500">중복 후보</p>
          <p className="mt-1 text-2xl font-bold">{data.duplicateCandidates}</p>
          <p className="mt-1 text-xs text-zinc-600">크롤러 fingerprint 충돌</p>
        </Link>
        <Link
          href="/admin/seeds"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-400"
        >
          <p className="text-xs uppercase tracking-wide text-zinc-500">시드</p>
          <p className="mt-1 text-2xl font-bold">{data.seedActive}</p>
          <p className="mt-1 text-xs text-zinc-600">
            pending {data.seedPending} · dead {data.seedDead}
          </p>
        </Link>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 크롤 실행</h2>
          <Link href="/admin/crawl-runs" className="text-sm text-blue-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {data.latestRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{new Date(run.startedAt).toLocaleString('ko-KR')}</p>
                <p className="text-xs text-zinc-500">
                  계정 {run.accountsSucceeded}/{run.accountsAttempted} · Show +{run.showsCreated} ·
                  시드 +{run.snowballAdded}
                  {run.durationMs ? ` · ${Math.round(run.durationMs / 1000)}s` : ''}
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs ${
                  run.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : run.status === 'blocked_suspected'
                    ? 'bg-red-100 text-red-800'
                    : run.status === 'partial'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {run.status}
              </span>
            </div>
          ))}
          {data.latestRuns.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              아직 크롤 실행 기록이 없습니다.
            </p>
          ) : null}
        </div>
      </section>

      <nav className="mt-10 flex gap-4 text-sm">
        <Link href="/admin/seeds" className="text-blue-600 hover:underline">
          시드 관리
        </Link>
        <Link href="/admin/incomplete" className="text-blue-600 hover:underline">
          보완 큐
        </Link>
        <Link href="/admin/crawl-runs" className="text-blue-600 hover:underline">
          CrawlRun 로그
        </Link>
      </nav>
    </main>
  );
}
