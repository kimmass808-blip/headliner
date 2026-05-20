/**
 * AC-16b — 보완 큐.
 * 3-탭: 예정 공연 / 지난 공연 / 중복 후보.
 * 각 카드: IG 원문 링크 + 누락 필드 inline 입력 폼 + 저장 시 completeness 재계산.
 *
 * 운영자 ROI 가이드:
 *   - 예정 공연 = 사용자 발견 가치 큼 (지금 갈 수 있는 공연)
 *   - 지난 공연 = 아카이브 가치 큼이지만 사용자 임팩트 낮음
 *   - 중복 후보 = AC-5 v5 자동 검출, 운영자 merge 결정 필요
 */

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { prisma } from '@mft/db';
import { formatMissingFieldsBadge, type MissingFieldKey } from '@mft/shared';

export const dynamic = 'force-dynamic';

type Tab = 'upcoming' | 'past' | 'duplicates';

interface SearchParams {
  tab?: Tab;
  missing?: string; // 'date' | 'venue' | 'artists'
}

async function saveFields(formData: FormData) {
  'use server';
  const showId = formData.get('showId')?.toString();
  if (!showId) return;
  const date = formData.get('date')?.toString().trim() || null;
  const venueText = formData.get('venueText')?.toString().trim() || null;
  const artistsText = formData.get('artists')?.toString().trim() || null;

  // 간단 적용 — 실제 production 흐름은 canonicalize·merge UX 거침.
  // V1 admin은 directly Show.{date,venue,artists}만 업데이트하고 completeness 재계산.
  // (artist 추가는 별도 endpoint로 옮길 필요 있음 — V1.1)

  const updates: Record<string, unknown> = {};
  if (date) updates.date = new Date(date);
  // venue·artists 변경은 별도 트랜잭션 필요 (canonicalize·upsert·재fingerprint·merge UX).
  // 본 V1 페이지는 date 보강만 처리. venue/artists는 /admin/shows/[id] 보정 폼으로 라우팅.

  if (Object.keys(updates).length === 0) {
    if (venueText || artistsText) {
      // 사용자가 venue/artists를 입력했지만 본 페이지는 date만 처리 — 풍부한 보정 라우트로 가이드
    }
    return;
  }

  // completeness 재계산 — Show 모델에 venueId/artists 관계 고려
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { artists: { select: { id: true } }, venue: { select: { id: true } } },
  });
  if (!show) return;
  const hasDate = !!(updates.date ?? show.date);
  const hasVenue = !!show.venueId;
  const hasArtists = show.artists.length >= 1;
  const completeness = (hasDate ? 1 : 0) + (hasVenue ? 1 : 0) + (hasArtists ? 1 : 0);
  const missingFields: string[] = [];
  if (!hasDate) missingFields.push('date');
  if (!hasVenue) missingFields.push('venue');
  if (!hasArtists) missingFields.push('artists');

  await prisma.show.update({
    where: { id: showId },
    data: {
      ...updates,
      completeness,
      missingFields,
      needsReview: completeness < 3,
    },
  });

  // TODO: completeness=3 도달 시 fingerprint 재계산 + AC-5b merge UX 발동 (별도 라우트 권고)

  revalidatePath('/admin/incomplete');
}

export default async function AdminIncompletePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab = 'upcoming', missing } = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseWhere = (() => {
    if (tab === 'duplicates') {
      return { duplicateOfShowId: { not: null } };
    }
    const w: Record<string, unknown> = { needsReview: true, duplicateOfShowId: null };
    if (tab === 'upcoming') {
      w.OR = [{ date: { gte: today } }, { date: null }];
    } else if (tab === 'past') {
      w.date = { lt: today };
    }
    if (missing) {
      w.missingFields = { has: missing };
    }
    return w;
  })();

  const shows = await prisma.show.findMany({
    where: baseWhere,
    orderBy:
      tab === 'past'
        ? [{ createdAt: 'desc' }]
        : tab === 'duplicates'
        ? [{ createdAt: 'desc' }]
        : [{ date: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 50,
    include: {
      venue: true,
      artists: true,
      festival: { select: { id: true, name: true } },
      duplicateOf: { select: { id: true, fingerprint: true } },
    },
  });

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← Admin Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold">보완 큐</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Model A — 미완 Show를 채워서 사용자 검색 신뢰도를 높입니다.
      </p>

      <nav className="mt-6 flex gap-1 border-b border-zinc-200 text-sm">
        {[
          ['upcoming', '예정 공연 (발견 가치 큼)'],
          ['past', '지난 공연 (아카이브)'],
          ['duplicates', '중복 후보 (merge 필요)'],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/incomplete?tab=${key}`}
            className={
              tab === key
                ? '-mb-px rounded-t border-x border-t border-zinc-200 bg-white px-3 py-2 font-medium'
                : 'px-3 py-2 text-zinc-600 hover:text-zinc-900'
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab !== 'duplicates' ? (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-zinc-500">누락 필드:</span>
          {[
            [undefined, '전체'],
            ['date', '날짜'],
            ['venue', '장소'],
            ['artists', '아티스트'],
          ].map(([value, label]) => {
            const href = value
              ? `/admin/incomplete?tab=${tab}&missing=${value}`
              : `/admin/incomplete?tab=${tab}`;
            const isActive = missing === value;
            return (
              <Link
                key={String(value ?? 'all')}
                href={href}
                className={
                  isActive
                    ? 'rounded bg-zinc-900 px-2 py-0.5 text-white'
                    : 'rounded px-2 py-0.5 text-zinc-600 hover:bg-zinc-100'
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {shows.map((show) => {
          const dateStr = show.date
            ? new Date(show.date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                weekday: 'short',
              })
            : null;
          const badge = formatMissingFieldsBadge(show.missingFields as MissingFieldKey[]);
          return (
            <article key={show.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">
                    {dateStr ?? '날짜 미정'} · {show.venue?.name ?? '장소 미정'}
                  </p>
                  <p className="mt-1 font-medium">
                    {show.title ??
                      show.artists.map((a) => a.canonicalName).join(', ') ??
                      '제목 미정'}
                  </p>
                  {badge ? (
                    <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      {badge}
                    </p>
                  ) : null}
                  {show.duplicateOf ? (
                    <p className="mt-2 text-xs text-red-600">
                      ⚠️ Show <code className="font-mono">{show.duplicateOf.id}</code> 와 동일한
                      fingerprint — admin 확인 필요
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-400 line-clamp-2">
                    {show.rawTextExcerpt}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <a
                    href={show.originalPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    IG 원문 →
                  </a>
                  <Link
                    href={`/admin/shows/${show.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    상세 보정 →
                  </Link>
                </div>
              </div>

              {tab !== 'duplicates' &&
              show.missingFields.includes('date') &&
              !show.date ? (
                <form action={saveFields} className="mt-3 flex items-end gap-2">
                  <input type="hidden" name="showId" value={show.id} />
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500">날짜 보강</label>
                    <input
                      type="date"
                      name="date"
                      className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-700"
                  >
                    저장
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
        {shows.length === 0 ? (
          <p className="py-12 text-center text-zinc-400">큐가 비어 있습니다.</p>
        ) : null}
      </div>
    </main>
  );
}
