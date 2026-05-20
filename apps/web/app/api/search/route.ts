/**
 * 검색 API 라우트 (AC-7, AC-7b, AC-8).
 *
 * `defaultSearchEngine.search(q)` 단일 호출로:
 *   - kind별 독립 쿼리 → 컨텍스트 분기 결정
 *   - tier-then-rank 정렬 (완성 Show 항상 위, 미완은 completeness 가중)
 *   - festival_mode일 경우 해당 Festival의 children Show 필터아웃
 *
 * 응답에는 검색 결과 + 컨텍스트 모드 + 카드 렌더링에 필요한 hydration 데이터 포함.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { defaultSearchEngine } from '@mft/search';
import { prisma } from '@mft/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HydratedCard {
  kind: 'show' | 'festival' | 'artist';
  id: string;
  finalScore: number;
  tier: 0 | 1;
  data: unknown; // 카드별 hydration 데이터
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10), 100);

  if (!q) {
    return NextResponse.json({
      query: '',
      contextMode: 'mixed',
      results: [],
    });
  }

  const start = Date.now();
  const search = await defaultSearchEngine.search(q, { limit });

  // hydration — 카드별 표시에 필요한 필드만 가져옴
  const showIds = search.results.filter((r) => r.kind === 'show').map((r) => r.id);
  const festivalIds = search.results.filter((r) => r.kind === 'festival').map((r) => r.id);
  const artistIds = search.results.filter((r) => r.kind === 'artist').map((r) => r.id);

  const [shows, festivals, artists] = await Promise.all([
    showIds.length
      ? prisma.show.findMany({
          where: { id: { in: showIds } },
          select: {
            id: true,
            date: true,
            startTime: true,
            title: true,
            originalPostUrl: true,
            imageUrl: true,
            completeness: true,
            missingFields: true,
            stage: true,
            festivalId: true,
            venue: { select: { id: true, name: true } },
            artists: { select: { id: true, canonicalName: true } },
            festival: { select: { id: true, name: true } },
          },
        })
      : [],
    festivalIds.length
      ? prisma.festival.findMany({
          where: { id: { in: festivalIds } },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            locationText: true,
            posterImageUrl: true,
            officialUrl: true,
            ticketUrl: true,
            completeness: true,
          },
        })
      : [],
    artistIds.length
      ? prisma.artist.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, canonicalName: true, aliases: true, igHandle: true },
        })
      : [],
  ]);

  const showMap = new Map(shows.map((s) => [s.id, s]));
  const festivalMap = new Map(festivals.map((f) => [f.id, f]));
  const artistMap = new Map(artists.map((a) => [a.id, a]));

  const hydrated: HydratedCard[] = search.results
    .map((r): HydratedCard | null => {
      const data =
        r.kind === 'show'
          ? showMap.get(r.id)
          : r.kind === 'festival'
          ? festivalMap.get(r.id)
          : artistMap.get(r.id);
      if (!data) return null;
      return {
        kind: r.kind,
        id: r.id,
        finalScore: r.finalScore,
        tier: r.tier,
        data,
      };
    })
    .filter((x): x is HydratedCard => x !== null);

  const durationMs = Date.now() - start;
  return NextResponse.json({
    query: q,
    contextMode: search.contextMode,
    primaryFestivalId: search.primaryFestivalId,
    primaryArtistId: search.primaryArtistId,
    results: hydrated,
    meta: { durationMs, total: hydrated.length },
  });
}
