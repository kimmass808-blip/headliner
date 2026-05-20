// Vercel Cron 엔트리포인트 (vercel.json의 cron schedule이 6시간마다 호출).
//
// Phase 1 `@mft/crawler` 의 `runCrawl` 호출.
// 5분 timeout 안 1배치 처리. 결과 통계는 CrawlRun row에 적재.
//
// Vercel Cron 보안: 헤더 `x-vercel-cron`이 있으면 정상. 외부에서 호출 시 401.
// (Vercel Hobby tier 에서는 CRON_SECRET 환경 변수도 사용 가능 — 추가 layer.)

import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5분 (Vercel Hobby 한도)

export async function GET(req: NextRequest) {
  // Vercel Cron 헤더 검증
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!isVercelCron && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 동적 import — Vercel Build 시 crawler 패키지가 빌드되어 있다고 가정.
    const { runCrawl } = await import('@mft/crawler');
    const result = await runCrawl();
    return NextResponse.json({
      ok: true,
      crawlRunId: result.crawlRunId,
      durationMs: result.durationMs,
      summary: result.summary,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    // 크롤러 실패가 archive-only fallback의 핵심 — 에러만 기록하고 500 반환.
    // 웹 검색 라우트는 이 실패와 무관하게 정상 작동.
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
