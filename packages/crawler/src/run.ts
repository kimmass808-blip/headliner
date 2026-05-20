/**
 * Vercel Cron entrypoint — 5분 timeout 안 1배치 (AC-1, AC-6b, AC-18, AC-22, Phase 1.6)
 *
 * 흐름:
 *   1. CrawlRun row 생성 (status='running')
 *   2. SeedAccount.status IN ('active', 'pending'), lastFetched 오름차순, top N
 *   3. 각 계정: fetchAccountPosts → recordFetchOutcome → maybePromoteSeed
 *      → 게시물별: classify → extract → upsertShow/Festival → expandSeed
 *   4. CrawlRun 종료: counters, status='success'|'partial'|'blocked_suspected'
 *   5. AC-18: 배치 40x/429 ≥50% AND 24h rolling ≥2회 → Discord webhook
 */

import { prisma } from '@mft/db';
import { computeShowCompleteness } from '@mft/shared';
import type { PostType, ShowExtraction, FestivalExtraction } from '@mft/shared';
import { canonicalizeInstagramUrl } from '@mft/canonicalize';
import { fetchAccountPosts } from './ig-fetch.js';
import { upsertShow } from './dedup.js';
import { expandSeed } from './seed-expand.js';
import { maybePromoteSeed, recordFetchOutcome } from './seed-lifecycle.js';

// ── 알림 ────────────────────────────────────────────────────────────────────

/**
 * AC-18: Discord webhook으로 차단 의심 알림 전송.
 * apps/web/lib/notify.ts 미의존 — 직접 fetch POST.
 */
export async function notifyBlockedSuspected(crawlRunId: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `⚠️ **[MFT Crawler] 차단 의심 감지**\nCrawlRun \`${crawlRunId}\` — HTTP 40x/429 응답률 ≥50%\n24h rolling window ≥2회 감지. 크롤러 cron을 확인해주세요.`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // 알림 실패는 무시 (크롤링 결과에 영향 없음)
  }
}

// ── Normalizer 스텁 (Phase 1.7 평가 후 실제 구현으로 교체) ───────────────

/**
 * 게시물 분류 — Phase 1.7 LLM 평가 전 임시 스텁.
 * 실제 classify 함수가 구현되면 @mft/normalizer에서 import.
 */
async function classifyPost(_rawText: string): Promise<PostType> {
  // TODO(Phase 1.7): LLM 분류기로 교체
  return 'unrelated';
}

/**
 * 단독공연 추출 스텁.
 */
async function extractShow(_rawText: string): Promise<ShowExtraction | null> {
  // TODO(Phase 1.7): LLM 추출로 교체
  return null;
}

/**
 * 페스티벌 추출 스텁.
 */
async function extractFestival(_rawText: string): Promise<FestivalExtraction | null> {
  // TODO(Phase 1.7): LLM 추출로 교체
  return null;
}

// ── 유틸 ────────────────────────────────────────────────────────────────────

/** 24h rolling window에서 blocked_suspected CrawlRun 개수 조회 */
async function countRecentBlockedRuns(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.crawlRun.count({
    where: {
      status: 'blocked_suspected',
      startedAt: { gte: since },
    },
  });
}

// ── 메인 ────────────────────────────────────────────────────────────────────

export async function runCrawl(opts?: {
  maxAccounts?: number;
  maxPendingPosts?: number;   // per-account cap for status='pending' (default 5, AC-1)
  maxActivePosts?: number;    // per-account cap for status='active' (default 50)
  snowballBatchCap?: number;  // default 5 (AC-6b)
}): Promise<{ crawlRunId: string; durationMs: number; summary: object }> {
  const maxAccounts = opts?.maxAccounts ?? 50;
  const maxPendingPosts = opts?.maxPendingPosts ?? 5;
  const maxActivePosts = opts?.maxActivePosts ?? 50;
  const snowballBatchCap = opts?.snowballBatchCap ?? 5;

  const startedAt = Date.now();

  // 1. CrawlRun 시작
  const crawlRun = await prisma.crawlRun.create({
    data: { status: 'running' },
    select: { id: true },
  });
  const crawlRunId = crawlRun.id;

  // 카운터
  let accountsAttempted = 0;
  let accountsSucceeded = 0;
  let postsFetched = 0;
  let postsClassified = 0;
  let showsCreated = 0;
  let showsUpdated = 0;
  let festivalsCreated = 0;
  let snowballAdded = 0;
  const errors: Array<{ account: string; reason: string }> = [];

  // snowball batch state (AC-6b)
  const batchState = { remainingSlots: snowballBatchCap };

  // AC-18: 응답 상태 추적
  let totalHttpAttempts = 0;
  let blockedHttpCount = 0;

  try {
    // 2. SeedAccount 조회 — active+pending, lastFetched 오름차순 (가장 오래된 것 먼저)
    const seeds = await prisma.seedAccount.findMany({
      where: { status: { in: ['active', 'pending'] } },
      orderBy: { lastFetched: 'asc' },
      take: maxAccounts,
      select: { igHandle: true, status: true, lastFetched: true },
    });

    // 3. 계정별 처리
    for (const seed of seeds) {
      accountsAttempted += 1;
      const maxPosts = seed.status === 'pending' ? maxPendingPosts : maxActivePosts;

      // 3-a. 게시물 fetch
      const fetchResult = await fetchAccountPosts(seed.igHandle, {
        sinceTimestamp: seed.lastFetched ?? undefined,
        maxPosts,
      });

      // AC-18 HTTP 상태 추적
      if (fetchResult.httpStatus !== null) {
        totalHttpAttempts += 1;
        const status = fetchResult.httpStatus;
        if (status === 429 || (status >= 400 && status < 500)) {
          blockedHttpCount += 1;
        }
      }

      // 3-b. 상태 라이프사이클 갱신
      await recordFetchOutcome(seed.igHandle, fetchResult);
      await maybePromoteSeed(seed.igHandle, fetchResult);

      if (fetchResult.httpStatus === 200) {
        accountsSucceeded += 1;
      }

      postsFetched += fetchResult.posts.length;

      // 3-c. 게시물별 처리
      for (const post of fetchResult.posts) {
        if (post.status !== 'success') continue;

        const canonicalUrl = canonicalizeInstagramUrl(post.canonicalUrl);

        // 이미 처리한 게시물인지 확인
        const existingPost = await prisma.instagramPost.findUnique({
          where: { canonicalUrl },
          select: { canonicalUrl: true, extractedShowId: true, extractedFestivalId: true },
        });

        // classify
        const postType = await classifyPost(post.rawText);
        postsClassified += 1;

        let extractedShowId: string | null = null;
        let extractedFestivalId: string | null = null;

        if (postType === 'single_show') {
          const extraction = await extractShow(post.rawText);
          if (extraction) {
            const { completeness } = computeShowCompleteness(extraction);
            if (completeness >= 1) {
              try {
                const upsertResult = await upsertShow({
                  extraction,
                  originalPostUrl: canonicalUrl,
                  rawTextExcerpt: post.rawText.slice(0, 500),
                });
                extractedShowId = upsertResult.showId;
                if (upsertResult.isNew) showsCreated += 1;
                else showsUpdated += 1;
              } catch (err) {
                errors.push({
                  account: seed.igHandle,
                  reason: `upsertShow 실패: ${err instanceof Error ? err.message : String(err)}`,
                });
              }
            }
            // completeness=0: InstagramPost만 저장 (extractedShowId=null)
          }
        } else if (postType === 'festival_lineup') {
          const extraction = await extractFestival(post.rawText);
          if (extraction && extraction.name) {
            try {
              // Festival upsert
              const festKey = extraction.name.toLowerCase().replace(/\s+/g, '_');
              const festival = await prisma.festival.upsert({
                where: { canonicalKey: festKey },
                create: {
                  name: extraction.name,
                  canonicalKey: festKey,
                  aliases: [],
                  startDate: extraction.startDate ? new Date(extraction.startDate) : null,
                  endDate: extraction.endDate ? new Date(extraction.endDate) : null,
                  locationText: extraction.locationText ?? null,
                  officialUrl: extraction.officialUrl ?? null,
                  ticketUrl: extraction.ticketUrl ?? null,
                  posterImageUrl: extraction.posterImageUrl ?? null,
                  description: extraction.description ?? null,
                  completeness: ((extraction.name ? 1 : 0) + (extraction.startDate ? 1 : 0)) as 0 | 1 | 2,
                  needsReview: !extraction.startDate,
                },
                update: {
                  startDate: extraction.startDate ? new Date(extraction.startDate) : undefined,
                  endDate: extraction.endDate ? new Date(extraction.endDate) : undefined,
                },
                select: { id: true },
              });
              extractedFestivalId = festival.id;
              festivalsCreated += 1;

              // 라인업 set마다 Show 생성
              for (const set of extraction.sets) {
                const showExtraction: ShowExtraction = {
                  date: extraction.startDate ?? null,
                  venueText: extraction.locationText ?? null,
                  artistNames: set.artistNames,
                  startTime: set.startTime ?? undefined,
                };
                const { completeness } = computeShowCompleteness(showExtraction);
                if (completeness >= 1) {
                  try {
                    const upsertResult = await upsertShow({
                      extraction: showExtraction,
                      originalPostUrl: `${canonicalUrl}#set-${set.setOrder ?? set.artistNames.join('-')}`,
                      rawTextExcerpt: post.rawText.slice(0, 500),
                      festivalId: festival.id,
                      stage: set.stage ?? null,
                      setOrder: set.setOrder ?? null,
                    });
                    if (upsertResult.isNew) showsCreated += 1;
                    else showsUpdated += 1;
                  } catch {
                    // set Show 생성 실패는 무시 (Festival은 이미 저장됨)
                  }
                }
              }

              // AC-6: snowball 확장
              const expandResult = await expandSeed(
                {
                  postId: canonicalUrl,
                  sourceSeedHandle: seed.igHandle,
                  extractedFestivalId: festival.id,
                  mentionedHandles: extraction.mentionedHandles,
                },
                batchState,
              );
              snowballAdded += expandResult.added;
            } catch (err) {
              errors.push({
                account: seed.igHandle,
                reason: `festival upsert 실패: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          }
        }

        // InstagramPost 저장/갱신
        const postData = {
          sourceAccount: post.sourceAccount,
          postedAt: post.postedAt,
          rawText: post.rawText,
          imageUrls: post.imageUrls,
          postType,
          extractedShowId,
          extractedFestivalId,
        };

        if (existingPost) {
          await prisma.instagramPost.update({
            where: { canonicalUrl },
            data: postData,
          });
        } else {
          await prisma.instagramPost.create({
            data: { canonicalUrl, ...postData },
          });
        }
      }
    }

    // 4. AC-18 차단 감지
    const blockRate =
      totalHttpAttempts > 0 ? blockedHttpCount / totalHttpAttempts : 0;
    const isBlockedSuspected = blockRate >= 0.5;

    let finalStatus: string;
    if (isBlockedSuspected) {
      finalStatus = 'blocked_suspected';
    } else if (errors.length > 0) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'success';
    }

    const durationMs = Date.now() - startedAt;

    // CrawlRun 종료
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        finishedAt: new Date(),
        status: finalStatus,
        accountsAttempted,
        accountsSucceeded,
        postsFetched,
        postsClassified,
        showsCreated,
        showsUpdated,
        festivalsCreated,
        snowballAdded,
        durationMs,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    // AC-18: blocked_suspected + 24h rolling ≥2회 → Discord 알림
    if (isBlockedSuspected) {
      const recentBlocked = await countRecentBlockedRuns();
      if (recentBlocked >= 2) {
        await notifyBlockedSuspected(crawlRunId);
      }
    }

    const summary = {
      status: finalStatus,
      accountsAttempted,
      accountsSucceeded,
      postsFetched,
      postsClassified,
      showsCreated,
      showsUpdated,
      festivalsCreated,
      snowballAdded,
      errors: errors.length,
      blockRate: Math.round(blockRate * 100),
    };

    return { crawlRunId, durationMs, summary };
  } catch (err) {
    // 예상치 못한 오류 — CrawlRun을 failed로 마킹
    const durationMs = Date.now() - startedAt;
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        durationMs,
        errors: [{ reason: err instanceof Error ? err.message : String(err) }],
      },
    }).catch(() => {
      // DB 업데이트 실패도 무시 (원본 오류 전파가 중요)
    });

    throw err;
  }
}
