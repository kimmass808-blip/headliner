/**
 * computeShowFingerprint 단위 테스트 (AC-5, Phase 1 Verification)
 *
 * 검증 항목:
 *   1. 같은 입력 → 같은 hash (결정론적)
 *   2. artistCanonicalKeys sort 순서 무관 → 같은 hash (code-unit sort 안정성)
 *   3. date/venue/artist 셋 중 하나 바뀌면 다른 hash
 */

import { describe, it, expect } from 'vitest';
import { computeShowFingerprint } from '../fingerprint.js';

describe('computeShowFingerprint', () => {
  const base = {
    dateIso: '2025-08-15',
    venueCanonicalKey: 'rolling_hall',
    artistCanonicalKeys: ['artist_a', 'artist_b', 'artist_c'],
  };

  it('같은 입력은 항상 같은 hash를 반환한다', () => {
    const h1 = computeShowFingerprint(base);
    const h2 = computeShowFingerprint(base);
    expect(h1).toBe(h2);
  });

  it('artistCanonicalKeys 입력 순서와 무관하게 같은 hash를 반환한다', () => {
    const reversed = computeShowFingerprint({
      ...base,
      artistCanonicalKeys: ['artist_c', 'artist_a', 'artist_b'],
    });
    const shuffled = computeShowFingerprint({
      ...base,
      artistCanonicalKeys: ['artist_b', 'artist_c', 'artist_a'],
    });
    const original = computeShowFingerprint(base);

    expect(reversed).toBe(original);
    expect(shuffled).toBe(original);
  });

  it('date가 다르면 다른 hash를 반환한다', () => {
    const different = computeShowFingerprint({
      ...base,
      dateIso: '2025-08-16',
    });
    expect(different).not.toBe(computeShowFingerprint(base));
  });

  it('venue가 다르면 다른 hash를 반환한다', () => {
    const different = computeShowFingerprint({
      ...base,
      venueCanonicalKey: 'ff_venue',
    });
    expect(different).not.toBe(computeShowFingerprint(base));
  });

  it('artist 목록이 다르면 다른 hash를 반환한다', () => {
    const different = computeShowFingerprint({
      ...base,
      artistCanonicalKeys: ['artist_a', 'artist_b'],
    });
    expect(different).not.toBe(computeShowFingerprint(base));
  });

  it('빈 artist 목록도 결정론적으로 처리된다', () => {
    const h1 = computeShowFingerprint({ ...base, artistCanonicalKeys: [] });
    const h2 = computeShowFingerprint({ ...base, artistCanonicalKeys: [] });
    expect(h1).toBe(h2);
  });

  it('결과는 64자 hex 문자열(sha256)이다', () => {
    const hash = computeShowFingerprint(base);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('단일 아티스트 배열도 sort 안정성 유지', () => {
    const h = computeShowFingerprint({ ...base, artistCanonicalKeys: ['only_artist'] });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
