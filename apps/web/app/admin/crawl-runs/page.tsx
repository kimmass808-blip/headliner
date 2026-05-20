/**
 * AC-17b — CrawlRun 관측 페이지.
 * 최근 50건 표시. 운영 지속성 모니터링용.
 */

import Link from 'next/link';
import { prisma } from '@mft/db';

export const dynamic = 'force-dynamic';

export default async function CrawlRunsPage() {
  const runs = await prisma.crawlRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Admin Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold">CrawlRun 로그</h1>
      <p className="mt-1 text-sm text-zinc-500">최근 50건. AC-22 트리거(4분 초과 2회)·AC-18 검출 모니터링.</p>

      <table className="mt-6 w-full text-left text-xs">
        <thead className="border-b border-zinc-200 uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-2">시작</th>
            <th>status</th>
            <th>계정</th>
            <th>posts</th>
            <th>Show</th>
            <th>Festival</th>
            <th>시드+</th>
            <th>LLM¢</th>
            <th>실행시간</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 font-mono">
          {runs.map((r) => {
            const duration = r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '-';
            const slow = r.durationMs && r.durationMs > 4 * 60 * 1000;
            return (
              <tr key={r.id} className={slow ? 'bg-red-50' : ''}>
                <td className="py-2">{new Date(r.startedAt).toLocaleString('ko-KR')}</td>
                <td>
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      r.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : r.status === 'blocked_suspected'
                        ? 'bg-red-100 text-red-800'
                        : r.status === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : r.status === 'running'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td>
                  {r.accountsSucceeded}/{r.accountsAttempted}
                </td>
                <td>
                  {r.postsClassified}/{r.postsFetched}
                </td>
                <td>+{r.showsCreated}</td>
                <td>+{r.festivalsCreated}</td>
                <td>+{r.snowballAdded}</td>
                <td>
                  {(r.llmCostCents / 100).toFixed(2)}$
                  <span className="ml-1 text-zinc-400">
                    ({Math.round((r.llmTokensIn + r.llmTokensOut) / 1000)}K)
                  </span>
                </td>
                <td className={slow ? 'font-bold text-red-700' : ''}>{duration}</td>
              </tr>
            );
          })}
          {runs.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center font-sans text-zinc-400">
                실행 기록 없음
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="mt-6 text-xs text-zinc-500">
        AC-22 트리거: 실행시간 4분 초과 2회 연속 → <code>docs/runbooks/fly-migration.md</code> 발동.
        <br />
        AC-18 트리거: status=blocked_suspected가 24h 안에 2회 → Discord 알림 (자동).
      </p>
    </main>
  );
}
