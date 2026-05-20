/**
 * IG 게시물 분류기
 * AC-2 head-to-head 평가 대상 (openai-mini vs anthropic-haiku)
 */

import { ClassificationResultSchema, type ClassificationResult } from '@mft/shared';
import { createLlmClient, type LlmCallResult, type LlmProvider } from './llm-client.js';
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserPrompt } from './prompts/classify.js';

export interface ClassifyResult {
  classification: ClassificationResult;
  llmCall: LlmCallResult;
}

/**
 * IG 게시물 텍스트를 4개 라벨 중 하나로 분류한다.
 *
 * @param rawText IG 게시물 원문
 * @param opts.provider LLM 프로바이더 (기본값: ENV.LLM_PROVIDER → 'openai-mini')
 */
export async function classify(
  rawText: string,
  opts?: { provider?: LlmProvider },
): Promise<ClassifyResult> {
  const provider =
    opts?.provider ??
    (process.env.LLM_PROVIDER as LlmProvider | undefined) ??
    'openai-mini';

  const client = createLlmClient(provider);

  const llmCall = await client.call({
    systemPrompt: CLASSIFY_SYSTEM_PROMPT,
    userPrompt: buildClassifyUserPrompt(rawText),
    temperature: 0.1,
    maxTokens: 200,
  });

  const parsed = ClassificationResultSchema.parse(JSON.parse(llmCall.text));

  return { classification: parsed, llmCall };
}
