/**
 * expandSeed 단위 테스트 (AC-6 시리즈, Phase 1 Verification)
 *
 * 검증 항목:
 *   1. snowball→snowball 케이스 skip (depth=1 cap)
 *   2. ≤5/batch cap 확인
 *   3. 이미 존재하는 계정 skip
 *   4. 잘못된 핸들 형식 skip (해시태그·이메일·trailing dot)
 *   5. extractedFestivalId=null이면 전부 skip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// @mft/db를 mock. vi.mock은 hoisting되므로 top-level에 선언.
const findUniqueMock = vi.fn();
const createMock = vi.fn();

vi.mock('@mft/db', () => ({
  prisma: {
    seedAccount: {
      findUnique: findUniqueMock,
      create: createMock,
    },
  },
}));

// mock 설정 후 import
import { expandSeed } from '../seed-expand.js';
import type { ExpandSeedInput } from '../seed-expand.js';

describe('expandSeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({});
  });

  // ── AC-6c: extractedFestivalId=null이면 skip ─────────────────────────────

  it('extractedFestivalId=null이면 모든 핸들을 skippedDepthCap으로 처리한다', async () => {
    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'festival_account',
      extractedFestivalId: null,
      mentionedHandles: ['@artist1', '@artist2'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(0);
    expect(result.skippedDepthCap).toBe(2);
    // prisma는 전혀 호출되지 않아야 함
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  // ── AC-6c: snowball→snowball depth cap ──────────────────────────────────

  it('sourceSeedHandle이 snowball 계정이면 모든 핸들을 skippedDepthCap으로 처리한다', async () => {
    // sourceSeed lookup → addedBy='snowball'
    findUniqueMock.mockResolvedValueOnce({ addedBy: 'snowball' });

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'snowball_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['@artist1', '@artist2', '@artist3'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(0);
    expect(result.skippedDepthCap).toBe(3);
    expect(createMock).not.toHaveBeenCalled();
  });

  // ── AC-6b: ≤5/batch cap ─────────────────────────────────────────────────

  it('remainingSlots=2이면 2개만 추가하고 나머지는 skippedBatchCap으로 처리한다', async () => {
    // sourceSeed → operator, 이후 모든 핸들은 신규(null)
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' }) // sourceSeed lookup
      .mockResolvedValue(null);                        // 모든 핸들 신규

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['@artist1', '@artist2', '@artist3', '@artist4'],
    };

    const batchState = { remainingSlots: 2 };
    const result = await expandSeed(input, batchState);

    expect(result.added).toBe(2);
    expect(result.skippedBatchCap).toBe(2);
    expect(batchState.remainingSlots).toBe(0);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  // ── AC-6: 이미 존재하는 계정 skip ───────────────────────────────────────

  it('이미 존재하는 계정은 skippedExistingCount로 처리한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' })    // sourceSeed
      .mockResolvedValueOnce({ igHandle: 'artist1' })    // artist1 이미 존재
      .mockResolvedValueOnce(null);                       // artist2 신규

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['@artist1', '@artist2'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(1);
    expect(result.skippedExistingCount).toBe(1);
  });

  // ── 잘못된 핸들 형식 skip ────────────────────────────────────────────────

  it('해시태그 핸들은 skip한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' }) // sourceSeed
      .mockResolvedValue(null);                        // 신규

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['#hashtagNotHandle', '@validartist'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(1); // validartist만 추가
  });

  it('이메일 형식 핸들은 skip한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' })
      .mockResolvedValue(null);

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['user@example.com', '@validartist'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(1);
  });

  it('trailing dot 핸들은 strip 후 유효하면 추가한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' })
      .mockResolvedValue(null);

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: ['@artist.'], // trailing dot strip 후 'artist' → 유효
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(1);
  });

  it('31자 이상 핸들은 skip한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' })
      .mockResolvedValue(null);

    const tooLong = 'a'.repeat(31);
    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/abc123/',
      sourceSeedHandle: 'operator_account',
      extractedFestivalId: 'festival-id-1',
      mentionedHandles: [`@${tooLong}`, '@validhandle'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(1); // validhandle만 추가
  });

  // ── operator 시드 계정 게시물에서 정상 snowball 추가 ─────────────────────

  it('operator 시드 계정 게시물에서 신규 핸들을 pending으로 추가한다', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ addedBy: 'operator' }) // sourceSeed
      .mockResolvedValue(null);                        // 모든 핸들 신규

    const input: ExpandSeedInput = {
      postId: 'https://www.instagram.com/p/festival123/',
      sourceSeedHandle: 'festival_org',
      extractedFestivalId: 'festival-id-2',
      mentionedHandles: ['@band_a', '@band_b'],
    };

    const result = await expandSeed(input, { remainingSlots: 5 });
    expect(result.added).toBe(2);
    expect(result.skippedDepthCap).toBe(0);
    expect(result.skippedBatchCap).toBe(0);

    // create 호출 확인 — addedBy='snowball', status='pending'
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addedBy: 'snowball',
          status: 'pending',
          sourceSeedHandle: 'festival_org',
        }),
      }),
    );
  });
});
