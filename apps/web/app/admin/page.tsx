/**
 * /admin — 대시보드. 크롤 파이프라인 현황 요약 + 빠른 작업 링크.
 */

import Link from 'next/link';
import { prisma } from '@mft/db';
import { Icon } from '../../components/admin/Icon';

export const dynamic = 'force-dynamic';

const ACCENTS: Record<string, string> = {
  amber: 'text-amber-600',
  blue: 'text-blue-600',
  red: 'text-red-600',
  emerald: 'text-emerald-600',
  zinc: 'text-zinc-700',
};

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
  href,
}: {
  label: string;
  value: number;
  sub: string;
  accent: keyof typeof ACCENTS;
  icon: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="mb-3 flex w-full items-center justify-between">
        <span className="text-[12px] font-medium text-zinc-500">{label}</span>
        <span className={`${ACCENTS[accent]} opacity-70`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-[32px] font-bold leading-none tracking-tight tabular-nums ${ACCENTS[accent]}`}>
          {value}
        </span>
      </div>
      <span className="mt-2 flex items-center gap-1 text-[12px] text-zinc-400">
        {sub}
        {href && <Icon name="chevRight" size={12} />}
      </span>
    </>
  );
  const cls = `group flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-5 text-left transition ${
    href ? 'hover:border-zinc-300 hover:shadow-sm' : ''
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    success: { c: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', t: '성공' },
    partial: { c: 'bg-amber-50 text-amber-700 ring-amber-600/20', t: '부분 성공' },
    failed: { c: 'bg-red-50 text-red-700 ring-red-600/20', t: '실패' },
    blocked_suspected: { c: 'bg-red-50 text-red-700 ring-red-600/20', t: '차단 의심' },
    running: { c: 'bg-blue-50 text-blue-700 ring-blue-600/20', t: '진행 중' },
  };
  const m = map[status] ?? { c: 'bg-zinc-100 text-zinc-600 ring-zinc-300', t: status };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.c}`}
    >
      {status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />}
      {m.t}
    </span>
  );
}

function QuickLink({
  icon,
  label,
  sub,
  accent,
  href,
}: {
  icon: string;
  label: string;
  sub: string;
  accent?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${
        accent ? 'border-blue-200 bg-blue-50/40 hover:border-blue-300' : 'border-zinc-200 bg-white hover:border-zinc-300'
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          accent ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-500'
        }`}
      >
        <Icon name={icon} size={17} />
      </span>
      <span className="flex-1">
        <span className="block text-[13px] font-semibold text-zinc-800">{label}</span>
        <span className="block text-[12px] text-zinc-400">{sub}</span>
      </span>
      <Icon name="chevRight" size={15} className="text-zinc-300 transition group-hover:text-zinc-500" />
    </Link>
  );
}

function SeedStat({ n, label, dot }: { n: number; label: string; dot: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[18px] font-bold tabular-nums text-zinc-800">{n}</span>
      </div>
      <div className="text-[11px] text-zinc-400">{label}</div>
    </div>
  );
}

async function loadDashboard() {
  const [
    pendingShows,
    pendingFestivals,
    incompleteShows,
    incompleteFestivals,
    dupCandidates,
    approvedCount,
    seedActive,
    seedPending,
    seedDead,
    ingestPending,
    crawlRuns,
  ] = await Promise.all([
    prisma.show.count({ where: { status: 'PENDING' } }),
    prisma.festival.count({ where: { status: 'PENDING' } }),
    prisma.show.count({ where: { status: 'PENDING', completeness: { lt: 3 } } }),
    prisma.festival.count({ where: { status: 'PENDING', completeness: { lt: 2 } } }),
    prisma.show.count({ where: { duplicateOfShowId: { not: null } } }),
    prisma.show.count({ where: { status: 'APPROVED' } }),
    prisma.seedAccount.count({ where: { status: 'active' } }),
    prisma.seedAccount.count({ where: { status: 'pending' } }),
    prisma.seedAccount.count({ where: { status: 'dead' } }),
    prisma.ingestSource.count({ where: { status: 'collected' } }),
    prisma.crawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        startedAt: true,
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
    pending: pendingShows + pendingFestivals,
    pendingShows,
    pendingFestivals,
    incomplete: incompleteShows + incompleteFestivals,
    dupCandidates,
    approvedCount,
    seedTotal: seedActive + seedPending + seedDead,
    seedActive,
    seedPending,
    seedDead,
    ingestPending,
    crawlRuns,
  };
}

export default async function AdminHomePage() {
  const d = await loadDashboard();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">대시보드</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">크롤 파이프라인 현황</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="검수 대기"
            value={d.pending}
            sub={`Show ${d.pendingShows} · Festival ${d.pendingFestivals}`}
            accent="amber"
            icon="inbox"
            href="/admin/review"
          />
          <StatCard label="보완 필요" value={d.incomplete} sub="완성도 미달" accent="red" icon="alert" href="/admin/review" />
          <StatCard label="중복 후보" value={d.dupCandidates} sub="기존 항목과 유사" accent="blue" icon="layers" href="/admin/review" />
          <StatCard
            label="시드 계정"
            value={d.seedActive}
            sub={`총 ${d.seedTotal} · 오류 ${d.seedDead}`}
            accent="emerald"
            icon="database"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                <Icon name="clock" size={15} className="text-zinc-400" /> 최근 크롤 실행
              </h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                    <th className="px-4 py-2 font-semibold">실행</th>
                    <th className="px-3 py-2 font-semibold">시각</th>
                    <th className="px-3 py-2 font-semibold">상태</th>
                    <th className="px-3 py-2 text-right font-semibold">계정 · 신규</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {d.crawlRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-[11px] text-zinc-400">{r.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500">
                        <div>{new Date(r.startedAt).toLocaleString('ko-KR')}</div>
                        {r.durationMs ? (
                          <div className="font-mono text-[11px] text-zinc-400">{Math.round(r.durationMs / 1000)}s</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <RunStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className="text-zinc-700">
                          {r.accountsSucceeded}/{r.accountsAttempted}
                        </span>
                        <span className="text-zinc-300"> · </span>
                        <span className="font-semibold text-blue-600">+{r.showsCreated}</span>
                      </td>
                    </tr>
                  ))}
                  {d.crawlRuns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[13px] text-zinc-400">
                        아직 크롤 실행 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="mb-2.5 text-[13px] font-semibold text-zinc-700">빠른 작업</h2>
              <div className="space-y-2">
                <QuickLink icon="inbox" label="검수 큐 열기" sub={`${d.pending}건 대기 중`} accent href="/admin/review" />
                <QuickLink icon="table" label="데이터 관리" sub={`승인 ${d.approvedCount}건`} href="/admin/data" />
                <QuickLink icon="refresh" label="적재 대기열" sub={`처리 대기 ${d.ingestPending}건`} href="/admin/ingest" />
                <QuickLink icon="database" label="시드 관리" sub={`활성 ${d.seedActive}건`} href="/admin/seeds" />
              </div>
            </div>

            <div>
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-zinc-700">
                <Icon name="database" size={15} className="text-zinc-400" /> 시드 상태
              </h2>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="bg-emerald-500" style={{ width: `${pct(d.seedActive, d.seedTotal)}%` }} />
                  <div className="bg-amber-400" style={{ width: `${pct(d.seedPending, d.seedTotal)}%` }} />
                  <div className="bg-red-500" style={{ width: `${pct(d.seedDead, d.seedTotal)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <SeedStat n={d.seedActive} label="활성" dot="bg-emerald-500" />
                  <SeedStat n={d.seedPending} label="대기" dot="bg-amber-400" />
                  <SeedStat n={d.seedDead} label="오류" dot="bg-red-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}
