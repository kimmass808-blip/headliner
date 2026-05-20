/**
 * @mft/normalizer — IG 게시물 텍스트 → 구조화된 Show/Festival.
 *
 * Phase 1 구현.
 * - classify(rawText) → PostType ('single_show' | 'festival_lineup' | 'setlist' | 'unrelated')
 * - extractShow(rawText) → ShowExtraction (partial 허용, AC-3)
 * - extractFestival(rawText) → FestivalExtraction (partial 허용, AC-4)
 */

export { classify } from './classify.js';
export { extractShow } from './extract-show.js';
export { extractFestival } from './extract-festival.js';
export type { ClassifyResult } from './classify.js';
export type { ExtractShowResult } from './extract-show.js';
export type { ExtractFestivalResult } from './extract-festival.js';
export type { LlmClient, LlmProvider, LlmCallResult } from './llm-client.js';
export { createLlmClient } from './llm-client.js';

// @mft/shared 재-export
export type { ClassificationResult, PostType } from '@mft/shared';
export type { ShowExtraction } from '@mft/shared';
export type { FestivalExtraction, FestivalSet } from '@mft/shared';
