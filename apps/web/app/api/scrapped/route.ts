/**
 * 스크랩 보관함 하이드레이션 API.
 *
 * 스크랩은 브라우저 localStorage에만 존재하므로(서버 사용자 모델 없음),
 * 클라이언트가 보유한 {kind, id} 목록을 POST로 보내면 카드 렌더에 필요한
 * 필드만 조회해 돌려준다. status='APPROVED'만 노출 — 미승인/삭제된 스크랩은
 * 자동으로 결과에서 빠진다(클라이언트가 stale id를 정리하는 신호로도 사용 가능).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@mft/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScrapRef {
  kind: 'show' | 'festival';
  id: string;
}

function parseRefs(body: unknown): ScrapRef[] {
  if (typeof body !== 'object' || body === null) return [];
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (x): x is ScrapRef =>
      typeof x === 'object' &&
      x !== null &&
      ((x as ScrapRef).kind === 'show' || (x as ScrapRef).kind === 'festival') &&
      typeof (x as ScrapRef).id === 'string',
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ shows: [], festivals: [] });
  }

  const refs = parseRefs(body);
  const showIds = refs.filter((r) => r.kind === 'show').map((r) => r.id);
  const festivalIds = refs.filter((r) => r.kind === 'festival').map((r) => r.id);

  if (showIds.length === 0 && festivalIds.length === 0) {
    return NextResponse.json({ shows: [], festivals: [] });
  }

  const [shows, festivals] = await Promise.all([
    showIds.length
      ? prisma.show.findMany({
          where: { id: { in: showIds }, status: 'APPROVED' },
          select: {
            id: true,
            title: true,
            imageUrl: true,
            firstSessionDate: true,
            venue: { select: { name: true } },
            artists: { select: { canonicalName: true } },
          },
        })
      : [],
    festivalIds.length
      ? prisma.festival.findMany({
          where: { id: { in: festivalIds }, status: 'APPROVED' },
          select: {
            id: true,
            name: true,
            posterImageUrl: true,
            startDate: true,
            endDate: true,
            locationText: true,
          },
        })
      : [],
  ]);

  return NextResponse.json({ shows, festivals });
}
