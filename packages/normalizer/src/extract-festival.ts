/**
 * 페스티벌 라인업 추출기
 * AC-4 (partial 허용 — name 또는 startDate)
 */

import { FestivalExtractionSchema, type FestivalExtraction } from '@mft/shared';
import { createLlmClient, type LlmCallResult, type LlmProvider } from './llm-client.js';
import {
  EXTRACT_FESTIVAL_SYSTEM_PROMPT,
  buildExtractFestivalUserPrompt,
} from './prompts/extract-festival.js';

export interface ExtractFestivalResult {
  extraction: FestivalExtraction;
  llmCall: LlmCallResult;
}

/**
 * IG 게시물 텍스트에서 페스티벌 라인업 정보를 추출한다.
 *
 * - LLM 응답 파싱 실패 시 빈 extraction 반환
 * - AC-4: name 또는 startDate 중 하나만 있어도 저장 대상
 *
 * @param rawText IG 게시물 원문
 * @param opts.provider LLM 프로바이더 (기본값: ENV.LLM_PROVIDER → 'openai-mini')
 */
export async function extractFestival(
  rawText: string,
  opts?: { provider?: LlmProvider },
): Promise<ExtractFestivalResult> {
  const provider =
    opts?.provider ??
    (process.env.LLM_PROVIDER as LlmProvider | undefined) ??
    'openai-mini';

  const client = createLlmClient(provider);

  const llmCall = await client.call({
    systemPrompt: EXTRACT_FESTIVAL_SYSTEM_PROMPT,
    userPrompt: buildExtractFestivalUserPrompt(rawText),
    temperature: 0.1,
    maxTokens: 1000,
  });

  // 파싱 실패 시 빈 extraction 반환
  const parseResult = FestivalExtractionSchema.safeParse(
    (() => {
      try {
        return JSON.parse(llmCall.text);
      } catch {
        return null;
      }
    })(),
  );

  if (!parseResult.success) {
    console.error('[extractFestival] LLM 응답 파싱 실패:', parseResult.error.message, {
      rawResponse: llmCall.text.slice(0, 200),
    });
    const emptyExtraction: FestivalExtraction = {
      name: null,
      startDate: null,
      sets: [],
      mentionedHandles: [],
    };
    return { extraction: emptyExtraction, llmCall };
  }

  return { extraction: parseResult.data, llmCall };
}
