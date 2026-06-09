/**
 * /admin/ingest — ingest 작업 대기열.
 *
 * ingest-collect(finalize.mjs)가 캡션 JSON을 수집하면 IngestSource에 'collected'(대기)로
 * 등록되고, ingest-show(scripts/ingest.ts)가 적재를 마치면 'loaded'(완료)로 도장찍힌다.
 * 이 페이지는 그 테이블을 읽어 "어떤 JSON이 있고, 아직 처리·적재해야 하는지"를 보여준다.
 */

import Link from 'next/link';
import { prisma } from '@mft/db';
import { Icon } from '../../../components/admin/Icon';

export const dynamic = 'force-dynamic';

function fmt(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Row = {
  igHandle: string;
  fullName: string | null;
  kind: string | null;
  status: string;
  fetched: number;
  mediaCount: number | null;
  complete: boolean | null;
  collectedAt: Date;
  loadedAt: Date | null;
  showsLoaded: number | null;
};

function HandleCell({ r }: { r: Row }) {
  return (
    <td className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <a
          href={`https://www.instagram.com/${r.igHandle}/`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[13px] font-semibold text-zinc-800 hover:text-blue-600 hover:underline dark:text-zinc-200"
        >
          @{r.igHandle}
        </a>
        {r.complete === false && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            불완전 수집
          </span>
        )}
      </div>
      {r.fullName && <div className="text-[11px] text-zinc-400">{r.fullName}</div>}
    </td>
  );
}

export default async function IngestQueuePage() {
  const [pending, loaded] = await Promise.all([
    prisma.ingestSource.findMany({
      where: { status: 'collected' },
      orderBy: { collectedAt: 'desc' },
    }),
    prisma.ingestSource.findMany({
      where: { status: 'loaded' },
      orderBy: { loadedAt: 'desc' },
      take: 200,
    }),
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">적재 대기열</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              수집된 캡션 JSON과 적재 현황. 처리·적재는 ingest-show 스킬로 직접 진행합니다.
            </p>
          </div>
          <Link href="/admin" className="text-[13px] text-zinc-500 hover:underline">
            ← 대시보드
          </Link>
        </div>

        {/* 요약 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="text-[12px] font-medium text-amber-700">⏳ 처리 대기</div>
            <div className="mt-1 text-[28px] font-bold tabular-nums text-amber-700">{pending.length}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="text-[12px] font-medium text-emerald-700">✅ 적재 완료</div>
            <div className="mt-1 text-[28px] font-bold tabular-nums text-emerald-700">{loaded.length}</div>
          </div>
        </div>

        {/* 처리 대기 */}
        <section className="mb-8">
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
            <Icon name="inbox" size={15} className="text-amber-500" /> 처리 대기 ({pending.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-2 font-semibold">계정</th>
                  <th className="px-3 py-2 text-right font-semibold">수집 게시물</th>
                  <th className="px-3 py-2 text-right font-semibold">수집 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pending.map((r: Row) => (
                  <tr key={r.igHandle} className="hover:bg-zinc-50/60">
                    <HandleCell r={r} />
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">
                      {r.fetched}
                      {r.mediaCount != null && <span className="text-zinc-300"> / {r.mediaCount}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">{fmt(r.collectedAt)}</td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[13px] text-zinc-400">
                      처리 대기 중인 수집물이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 적재 완료 */}
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
            <Icon name="check" size={15} className="text-emerald-500" /> 적재 완료 ({loaded.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-2 font-semibold">계정</th>
                  <th className="px-3 py-2 text-right font-semibold">적재 Show</th>
                  <th className="px-3 py-2 text-right font-semibold">적재 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loaded.map((r: Row) => (
                  <tr key={r.igHandle} className="hover:bg-zinc-50/60">
                    <HandleCell r={r} />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.showsLoaded != null ? (
                        <span className="font-semibold text-blue-600">{r.showsLoaded}</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">{fmt(r.loadedAt)}</td>
                  </tr>
                ))}
                {loaded.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[13px] text-zinc-400">
                      아직 적재된 수집물이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
