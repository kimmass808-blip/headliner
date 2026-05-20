/**
 * 통합 LLM 클라이언트 — OpenAI와 Anthropic 양쪽 지원
 * AC-2 head-to-head 평가용: openai-mini vs anthropic-haiku
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type LlmProvider = 'openai-mini' | 'anthropic-haiku';

export interface LlmCallResult {
  /** LLM 응답 텍스트 (JSON 문자열 예상) */
  text: string;
  tokensIn: number;
  tokensOut: number;
  /** 정수 cents, CrawlRun.llmCostCents 누적용 */
  costCents: number;
  model: string;
  provider: LlmProvider;
}

export interface LlmClient {
  call(opts: {
    systemPrompt: string;
    userPrompt: string;
    /** default 0.1 (deterministic structured output) */
    temperature?: number;
    /** default 1000 */
    maxTokens?: number;
  }): Promise<LlmCallResult>;
}

// 단가: 달러/1M 토큰 → cents/1M 토큰 = 달러 * 100
const PRICING: Record<LlmProvider, { inputCentsPer1M: number; outputCentsPer1M: number }> = {
  'openai-mini': { inputCentsPer1M: 15, outputCentsPer1M: 60 },    // $0.15/$0.60 per 1M
  'anthropic-haiku': { inputCentsPer1M: 80, outputCentsPer1M: 400 }, // $0.80/$4.00 per 1M
};

function computeCostCents(
  provider: LlmProvider,
  tokensIn: number,
  tokensOut: number,
): number {
  const p = PRICING[provider];
  const cents = (tokensIn * p.inputCentsPer1M + tokensOut * p.outputCentsPer1M) / 1_000_000;
  return Math.round(cents);
}

class OpenAiMiniClient implements LlmClient {
  private client: OpenAI;
  private readonly model = 'gpt-4o-mini';

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async call(opts: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmCallResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 1000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    });

    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;
    const text = response.choices[0]?.message?.content ?? '';

    return {
      text,
      tokensIn,
      tokensOut,
      costCents: computeCostCents('openai-mini', tokensIn, tokensOut),
      model: this.model,
      provider: 'openai-mini',
    };
  }
}

class AnthropicHaikuClient implements LlmClient {
  private client: Anthropic;
  private readonly model = 'claude-haiku-4-5';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async call(opts: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmCallResult> {
    const response = await this.client.messages.create({
      model: this.model,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 1000,
      system: opts.systemPrompt,
      messages: [
        { role: 'user', content: opts.userPrompt },
      ],
    });

    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;

    // Anthropic text block 추출
    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      text,
      tokensIn,
      tokensOut,
      costCents: computeCostCents('anthropic-haiku', tokensIn, tokensOut),
      model: this.model,
      provider: 'anthropic-haiku',
    };
  }
}

/**
 * LLM 클라이언트 팩토리.
 * provider가 지정되지 않으면 ENV.LLM_PROVIDER → 기본값 'openai-mini'.
 */
export function createLlmClient(provider: LlmProvider): LlmClient {
  switch (provider) {
    case 'openai-mini':
      return new OpenAiMiniClient();
    case 'anthropic-haiku':
      return new AnthropicHaikuClient();
    default: {
      // 컴파일 타임 exhaustive check
      const _exhaustive: never = provider;
      throw new Error(`알 수 없는 LLM 프로바이더: ${_exhaustive}`);
    }
  }
}
