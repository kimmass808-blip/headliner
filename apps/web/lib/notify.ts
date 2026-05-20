/**
 * Discord webhook 알림 헬퍼 (AC-18).
 *
 * 운영자-only 채널. 사용자-경로 외부 의존 0 (Principle 3 유지 — Discord는 알림 write-only).
 * `DISCORD_WEBHOOK_URL` 환경 변수 미설정 시 no-op (개발 환경에서 알림 안 보냄).
 */

export interface DiscordNotifyPayload {
  title: string;
  body: string;
  level?: 'info' | 'warning' | 'error';
}

const COLOR = {
  info: 0x5865f2,    // 파랑
  warning: 0xfee75c, // 노랑
  error: 0xed4245,   // 빨강
};

export async function notifyDiscord(payload: DiscordNotifyPayload): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    // 개발 환경 — silent no-op
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[notifyDiscord] DISCORD_WEBHOOK_URL 미설정, skip:', payload.title);
    }
    return false;
  }

  const level = payload.level ?? 'info';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `[MFT] ${payload.title}`,
            description: payload.body.slice(0, 4000),
            color: COLOR[level],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    return res.ok;
  } catch (e) {
    // 알림 실패가 크롤러를 죽이지 않도록 swallow
    // eslint-disable-next-line no-console
    console.error('[notifyDiscord] webhook failed:', e);
    return false;
  }
}

/** AC-18 트리거: 한 배치 HTTP 40x/429 ≥50% AND 24h rolling window ≥2회 시 호출 */
export async function notifyBlockedSuspected(opts: {
  attempted: number;
  failures: number;
  rollingCount: number;
}): Promise<void> {
  await notifyDiscord({
    title: '크롤러 차단 의심',
    body: [
      `이번 배치: ${opts.failures}/${opts.attempted} 실패`,
      `24h rolling window 임계 도달 횟수: ${opts.rollingCount}`,
      `archive-only fallback 진입 — 사용자 검색은 정상 작동 중.`,
      `admin 페이지에서 "재개" 누르면 다시 시작.`,
    ].join('\n'),
    level: 'error',
  });
}

/** 보완 큐 적체 주간 요약 (Risk row) */
export async function notifyQueueSummary(opts: {
  pendingShows: number;
  pendingFestivals: number;
  duplicateCandidates: number;
}): Promise<void> {
  await notifyDiscord({
    title: '주간 큐 요약',
    body: [
      `보완 대기 Show: ${opts.pendingShows}`,
      `보완 대기 Festival: ${opts.pendingFestivals}`,
      `중복 후보: ${opts.duplicateCandidates}`,
    ].join('\n'),
    level: 'info',
  });
}
