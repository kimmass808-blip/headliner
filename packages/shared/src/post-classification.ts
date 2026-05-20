import { z } from 'zod';

/**
 * IG 게시물 유형 분류 — LLM 출력 스키마
 * AC-2 (분류기 head-to-head 평가 대상)
 */
export const PostTypeSchema = z.enum([
  'single_show',
  'festival_lineup',
  'setlist',
  'unrelated',
]);

export type PostType = z.infer<typeof PostTypeSchema>;

export const ClassificationResultSchema = z.object({
  postType: PostTypeSchema,
  confidence: z.number().min(0).max(1).describe('LLM 자체 추정 신뢰도'),
  reasoning: z.string().optional().describe('분류 근거 (디버깅용)'),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
