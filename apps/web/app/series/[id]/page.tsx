/**
 * 페스티벌 시리즈(브랜드) 상세 — `/series/[id]`.
 *
 * 하나의 브랜드(FestivalSeries) 아래 묶인 연도별 페스티벌(editions)을
 * 최신순으로 모아 보여준다. 카드/그리드는 전체 페스티벌 목록과 동일하게 재사용.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../../components/home/Header';
import { BackLink } from '../../../components/common/BackLink';
import { ShowsGrid } from '../../../components/common/ShowsGrid';
import { ArrowUpRight } from '../../../components/common/Icons';
import { mapFestivalToItem } from '../../../lib/listings';
import { absoluteUrl, SITE_NAME } from '../../../lib/site';

export const dynamic = 'force-dynamic';

const editionSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  locationText: true,
  posterImageUrl: true,
} as const;

async function getSeries(id: string) {
  return prisma.festivalSeries.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      logoImageUrl: true,
      officialUrl: true,
      igHandle: true,
      status: true,
      editions: {
        where: { status: 'APPROVED', completeness: { gte: 1 } },
        orderBy: [{ editionYear: 'desc' }, { startDate: 'desc' }],
        select: { ...editionSelect, editionYear: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const series = await getSeries(id);
  if (!series || series.status !== 'APPROVED') {
    return { title: '시리즈를 찾을 수 없습니다' };
  }
  const url = absoluteUrl(`/series/${series.id}`);
  const description =
    series.description ??
    `${series.name} 역대 페스티벌 ${series.editions.length}회를 한곳에서. · ${SITE_NAME}`;
  return {
    title: `${series.name} · ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: series.name,
      description,
      url,
      ...(series.logoImageUrl ? { images: [{ url: series.logoImageUrl }] } : {}),
    },
  };
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = await getSeries(id);
  if (!series || series.status !== 'APPROVED') notFound();

  const items = series.editions.map(mapFestivalToItem);

  // 개최 연도 범위 ("2017–2026") — editionYear 우선, 없으면 startDate 연도.
  const years = series.editions
    .map((e) => e.editionYear ?? (e.startDate ? new Date(e.startDate).getFullYear() : null))
    .filter((y): y is number => y != null);
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearRange =
    minYear && maxYear ? (minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`) : null;

  const igUrl = series.igHandle
    ? `https://instagram.com/${series.igHandle.replace(/^@/, '')}`
    : null;

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />

      <main className="pb-24">
        <section className="mx-auto max-w-[1400px] px-6 pt-8 sm:px-10 sm:pt-10">
          <BackLink fallbackHref="/festivals" />
        </section>

        {/* 브랜드 헤더 */}
        <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {series.logoImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={series.logoImageUrl}
                alt={series.name}
                className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
              />
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[32px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[44px]">
                {series.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-paper/55">
                <span className="tabular-nums">총 {series.editions.length}회 개최</span>
                {yearRange ? (
                  <>
                    <span className="text-paper/25">·</span>
                    <span className="tabular-nums">{yearRange}</span>
                  </>
                ) : null}
              </div>

              {(series.officialUrl || igUrl) ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {series.officialUrl ? (
                    <a
                      href={series.officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-paper/85 transition-colors hover:border-white/35 hover:text-paper"
                    >
                      공식 사이트
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {igUrl ? (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-paper/85 transition-colors hover:border-white/35 hover:text-paper"
                    >
                      Instagram
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {series.description ? (
            <p className="mt-7 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-paper/75">
              {series.description}
            </p>
          ) : null}
        </section>

        {/* 에디션 목록 — 전체 페스티벌 목록과 동일한 카드 그리드 */}
        <ShowsGrid
          items={items}
          title="에디션"
          countSuffix="회"
          initialLimit={0}
          emptyLabel="등록된 에디션이 없습니다."
        />
      </main>
    </div>
  );
}
