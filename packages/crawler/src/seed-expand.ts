/**
 * 시드 확장 — 페스티벌 라인업 게시물의 @handle을 SeedAccount로 추가 (AC-6 시리즈)
 *
 * AC-6:   페스티벌 라인업 게시물의 @handle → SeedAccount(status='pending', addedBy='snowball')
 * AC-6b:  한 배치에서 ≤5건 cap (batchState.remainingSlots)
 * AC-6c:  sourceSeedHandle의 addedBy='snowball'이면 skip (depth=1)
 *         AND extractedFestivalId IS NULL이면 skip
 * AC-6:   이미 존재(어떤 status든) 시 skip
 */

import { prisma } from '@mft/db';
import { canonicalizeInstagramHandle } from '@mft/canonicalize';

export interface ExpandSeedInput {
  postId: string;                   // InstagramPost.canonicalUrl
  sourceSeedHandle: string;         // 이 게시물을 가져온 시드 계정
  extractedFestivalId: string | null; // null이면 snowball 건너뜀 (AC-6c)
  mentionedHandles: string[];
}

export interface ExpandSeedResult {
  added: number;
  skippedExistingCount: number;
  skippedDepthCap: number;
  skippedBatchCap: number;
}

/**
 * AC-6: 페스티벌 라인업 게시물의 @handle을 SeedAccount(status='pending', addedBy='snowball')로 추가.
 * AC-6b: 한 배치에서 ≤5건 (caller가 batch state 관리)
 * AC-6c: sourceSeedHandle의 addedBy='snowball'이면 skip (depth=1)
 *        AND extractedFestivalId IS NULL이면 skip
 * AC-6: 이미 존재 (어떤 status든) 시 skip
 */
export async function expandSeed(
  input: ExpandSeedInput,
  batchState: { remainingSlots: number },
): Promise<ExpandSeedResult> {
  const result: ExpandSeedResult = {
    added: 0,
    skippedExistingCount: 0,
    skippedDepthCap: 0,
    skippedBatchCap: 0,
  };

  // AC-6c: extractedFestivalId가 null이면 snowball 트리거 안 함
  if (!input.extractedFestivalId) {
    result.skippedDepthCap = input.mentionedHandles.length;
    return result;
  }

  // AC-6c: sourceSeedHandle의 addedBy 조회 — snowball로 추가된 계정이면 depth cap 발동
  const sourceSeed = await prisma.seedAccount.findUnique({
    where: { igHandle: input.sourceSeedHandle },
    select: { addedBy: true },
  });

  if (sourceSeed?.addedBy === 'snowball') {
    // snowball→snowball: depth=1 초과, 모두 skip
    result.skippedDepthCap = input.mentionedHandles.length;
    return result;
  }

  // 핸들 정규화 + upsert
  for (const rawHandle of input.mentionedHandles) {
    // batch cap 확인 (AC-6b)
    if (batchState.remainingSlots <= 0) {
      result.skippedBatchCap += 1;
      continue;
    }

    // canonicalize — 무효 핸들(해시태그·email·trailing dot) → null
    const handle = canonicalizeInstagramHandle(rawHandle);
    if (!handle) {
      // 무효 핸들 skip (카운터 없음 — 형식 오류)
      continue;
    }

    // 이미 존재하는 계정인지 확인 (어떤 status든)
    const existing = await prisma.seedAccount.findUnique({
      where: { igHandle: handle },
      select: { igHandle: true },
    });

    if (existing) {
      result.skippedExistingCount += 1;
      continue;
    }

    // 신규 추가
    await prisma.seedAccount.create({
      data: {
        igHandle: handle,
        kind: 'artist',           // 라인업 @handle은 기본적으로 artist로 분류 (운영자가 수정 가능)
        status: 'pending',
        addedBy: 'snowball',
        sourceSeedHandle: input.sourceSeedHandle,
      },
    });

    result.added += 1;
    batchState.remainingSlots -= 1;
  }

  return result;
}
