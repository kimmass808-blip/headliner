/**
 * SeedAccount status 전이 함수 (AC-6d, AC-6e)
 *
 * AC-6d: pending → active 승급 조건:
 *   (1) 1회 fetch 성공 (HTTP 200)
 *   (2) ≥1 post 수집 성공
 *   (3) 최근 90일 안에 게시물 있음
 *
 * AC-6e: consecutiveFails 증가 = HTTP error (4xx/5xx) OR network timeout
 *        HTTP 200 응답 시 consecutiveFails=0 reset (게시물 수 무관)
 *        3회 연속 → status='dead'
 */

import { prisma } from '@mft/db';
import type { FetchAccountResult } from './ig-fetch.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CONSECUTIVE_FAILS = 3;

/**
 * HTTP 200 성공 여부 판단.
 * httpStatus=200이고 error가 없으면 성공으로 간주.
 */
function isHttpSuccess(result: FetchAccountResult): boolean {
  return result.httpStatus === 200;
}

/**
 * 게시물 중 최근 90일 안의 것이 있는지 확인.
 */
function hasRecentPost(result: FetchAccountResult): boolean {
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
  return result.posts.some(
    (p) => p.status === 'success' && p.postedAt > cutoff,
  );
}

/**
 * AC-6d: pending → active 승급 조건 충족 시 status 변경.
 * 미충족이면 아무것도 하지 않음 (admin 검토 큐로 — 상태 변경 없음).
 */
export async function maybePromoteSeed(
  igHandle: string,
  fetchResult: FetchAccountResult,
): Promise<void> {
  const seed = await prisma.seedAccount.findUnique({
    where: { igHandle },
    select: { status: true },
  });

  if (!seed || seed.status !== 'pending') return;

  // 승급 조건: (1) HTTP 200, (2) ≥1 post 수집 성공, (3) 최근 90일 내 게시물
  const httpOk = isHttpSuccess(fetchResult);
  const hasPost = fetchResult.posts.some((p) => p.status === 'success');
  const recentPost = hasRecentPost(fetchResult);

  if (httpOk && hasPost && recentPost) {
    await prisma.seedAccount.update({
      where: { igHandle },
      data: {
        status: 'active',
        promotedAt: new Date(),
      },
    });
  }
  // 미충족 시 아무 것도 하지 않음 (admin 검토 큐에 pending 상태로 유지)
}

/**
 * AC-6e: fetch 결과에 따라 consecutiveFails 갱신.
 * - HTTP 200 → consecutiveFails=0 reset, lastFetched 갱신
 * - HTTP error(4xx/5xx) OR network timeout(httpStatus=null) → consecutiveFails+1
 * - consecutiveFails ≥ 3 → status='dead'
 */
export async function recordFetchOutcome(
  igHandle: string,
  result: FetchAccountResult,
): Promise<void> {
  const seed = await prisma.seedAccount.findUnique({
    where: { igHandle },
    select: { consecutiveFails: true, status: true },
  });

  if (!seed) return;
  // 이미 dead/rejected 상태면 변경 안 함
  if (seed.status === 'dead' || seed.status === 'rejected') return;

  if (isHttpSuccess(result)) {
    // HTTP 200 → reset
    await prisma.seedAccount.update({
      where: { igHandle },
      data: {
        consecutiveFails: 0,
        lastFetched: new Date(),
      },
    });
  } else {
    // HTTP error(4xx/5xx) OR timeout(null) → fail 카운트 증가
    const newFails = seed.consecutiveFails + 1;
    const isDead = newFails >= MAX_CONSECUTIVE_FAILS;

    await prisma.seedAccount.update({
      where: { igHandle },
      data: {
        consecutiveFails: newFails,
        lastFetched: new Date(),
        ...(isDead ? { status: 'dead', removedAt: new Date() } : {}),
      },
    });
  }
}
