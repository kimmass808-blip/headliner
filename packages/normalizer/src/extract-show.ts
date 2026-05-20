/**
 * 단독공연 정보 추출기
 * AC-3 (1필드 컷오프), AC-3b (partial Show 허용)
 */

import { ShowExtractionSchema, type ShowExtraction } from '@mft/shared';
import { createLlmClient, type LlmCallResult, type LlmProvider } from './llm-client.js';
import {
  EXTRACT_SHOW_SYSTEM_PROMPT,
  buildExtractShowUserPrompt,
} from './prompts/extract-show.js';

export interface ExtractShowResult {
  extraction: ShowExtraction;
  llmCall: LlmCallResult;
}

/**
 * IG 게시물 텍스트에서 단독공연 정보를 추출한다.
 *
 * - LLM 응답 파싱 실패 시 모든 필드 null인 extraction 반환 (completeness=0 → InstagramPost only)
 *
 * @param rawText IG 게시물 원문
 * @param opts.provider LLM 프로바이더 (기본값: ENV.LLM_PROVIDER → 'openai-mini')
 */
export async function extractShow(
  rawText: string,
  opts?: { provider?: LlmProvider },
): Promise<ExtractShowResult> {
  const provider =
    opts?.provider ??
    (process.env.LLM_PROVIDER as LlmProvider | undefined) ??
    'openai-mini';

  const client = createLlmClient(provider);

  const llmCall = await client.call({
    systemPrompt: EXTRACT_SHOW_SYSTEM_PROMPT,
    userPrompt: buildExtractShowUserPrompt(rawText),
    temperature: 0.1,
    maxTokens: 1000,
  });

  // 파싱 실패 시 null 추출 반환 — 호출 측에서 completeness=0으로 처리
  const parseResult = ShowExtractionSchema.safeParse(
    (() => {
      try {
        return JSON.parse(llmCall.text);
      } catch {
        return null;
      }
    })(),
  );

  if (!parseResult.success) {
    console.error('[extractShow] LLM 응답 파싱 실패:', parseResult.error.message, {
      rawResponse: llmCall.text.slice(0, 200),
    });
    const emptyExtraction: ShowExtraction = {
      date: null,
      venueText: null,
      artistNames: [],
    };
    return { extraction: emptyExtraction, llmCall };
  }

  return { extraction: parseResult.data, llmCall };
}
