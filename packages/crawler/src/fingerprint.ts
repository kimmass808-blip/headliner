import { createHash } from 'node:crypto';

/**
 * AC-5 (v4·v5) — Show fingerprint.
 *
 * `completeness = 3` 도달 시점에만 계산.
 * 입력은 canonicalize 후의 stable key들.
 * code-unit 정렬 (locale-independent, deterministic across runtimes).
 *
 * 같은 공연이 아티스트 IG·베뉴 IG 양쪽에서 추출되면 같은 fingerprint → 운영자 merge UX 발동.
 */

export interface FingerprintInputs {
  dateIso: string; // 'YYYY-MM-DD'
  venueCanonicalKey: string;
  artistCanonicalKeys: string[];
}

export function computeShowFingerprint(input: FingerprintInputs): string {
  // 명시적 code-unit sort (Array.prototype.sort default = lexicographic UTF-16)
  const sorted = [...input.artistCanonicalKeys].sort();
  const payload = `${input.dateIso}|${input.venueCanonicalKey}|${sorted.join(',')}`;
  return createHash('sha256').update(payload).digest('hex');
}
