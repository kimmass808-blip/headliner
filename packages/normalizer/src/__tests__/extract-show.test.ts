/**
 * 단독공연 추출기 단위 테스트 — 실제 LLM API 호출 없음 (mock)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmClient, LlmCallResult } from '../llm-client.js';
import { computeShowCompleteness } from '@mft/shared';

vi.mock('../llm-client.js', () => ({
  createLlmClient: vi.fn(),
}));

import { createLlmClient } from '../llm-client.js';
import { extractShow } from '../extract-show.js';

function makeMockClient(responseText: string): LlmClient {
  const mockResult: LlmCallResult = {
    text: responseText,
    tokensIn: 200,
    tokensOut: 150,
    costCents: 1,
    model: 'gpt-4o-mini',
    provider: 'openai-mini',
  };
  return {
    call: vi.fn().mockResolvedValue(mockResult),
  };
}

describe('extractShow()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('완전한 공연 정보를 올바르게 파싱한다 (completeness=3)', async () => {
    const mockResponse = JSON.stringify({
      date: '2025-03-15',
      startTime: '19:00',
      venueText: '홍대 클럽 FF',
      artistNames: ['새소년', '잔나비'],
      title: '봄 단독공연',
      ticketUrl: null,
      imageUrl: null,
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await extractShow('🎸 공연 안내\n일시: 2025년 3월 15일');

    expect(result.extraction.date).toBe('2025-03-15');
    expect(result.extraction.startTime).toBe('19:00');
    expect(result.extraction.venueText).toBe('홍대 클럽 FF');
    expect(result.extraction.artistNames).toEqual(['새소년', '잔나비']);

    const { completeness, missingFields } = computeShowCompleteness(result.extraction);
    expect(completeness).toBe(3);
    expect(missingFields).toHaveLength(0);
  });

  it('partial 추출을 올바르게 처리한다 — date 없음 (completeness=2)', async () => {
    const mockResponse = JSON.stringify({
      date: null,
      startTime: null,
      venueText: '을지OB베어',
      artistNames: ['밴드이름'],
      title: null,
      ticketUrl: null,
      imageUrl: null,
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await extractShow('다음 공연 곧 돌아옵니다 🎵\n장소: 을지OB베어');

    const { completeness, missingFields } = computeShowCompleteness(result.extraction);
    expect(completeness).toBe(2);
    expect(missingFields).toContain('date');
    expect(missingFields).not.toContain('venue');
    expect(missingFields).not.toContain('artists');
  });

  it('AC-3 1필드 컷오프 — venue만 있어도 저장 가능 (completeness=1)', async () => {
    const mockResponse = JSON.stringify({
      date: null,
      startTime: null,
      venueText: '클럽 무브',
      artistNames: [],
      title: null,
      ticketUrl: null,
      imageUrl: null,
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await extractShow('클럽 무브에서 봬요!');

    const { completeness } = computeShowCompleteness(result.extraction);
    expect(completeness).toBe(1);
    // 호출 측에서 completeness >= 1이면 저장 가능
    expect(completeness).toBeGreaterThanOrEqual(1);
  });

  it('LLM이 잘못된 JSON을 반환하면 빈 extraction을 반환한다', async () => {
    vi.mocked(createLlmClient).mockReturnValue(makeMockClient('invalid JSON {{{'));

    const result = await extractShow('some text');

    // 빈 extraction 반환 (에러 throw 아님)
    expect(result.extraction.date).toBeNull();
    expect(result.extraction.venueText).toBeNull();
    expect(result.extraction.artistNames).toEqual([]);

    const { completeness } = computeShowCompleteness(result.extraction);
    expect(completeness).toBe(0);
  });

  it('zod 스키마에 맞지 않는 LLM 응답은 빈 extraction을 반환한다', async () => {
    const invalidResponse = JSON.stringify({
      date: 'not-a-date', // 형식 불일치
      artistNames: 'string-not-array', // 타입 불일치
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(invalidResponse));

    const result = await extractShow('some text');

    expect(result.extraction.date).toBeNull();
    expect(result.extraction.artistNames).toEqual([]);
  });

  it('날짜 형식 검증 — YYYY-MM-DD만 허용', async () => {
    const validResponse = JSON.stringify({
      date: '2025-08-23',
      venueText: null,
      artistNames: ['아티스트'],
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(validResponse));

    const result = await extractShow('some text');
    expect(result.extraction.date).toBe('2025-08-23');
  });

  it('llmCall 비용 정보를 정확히 반환한다', async () => {
    const mockResponse = JSON.stringify({
      date: null,
      venueText: null,
      artistNames: [],
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await extractShow('some text');

    expect(result.llmCall.tokensIn).toBe(200);
    expect(result.llmCall.tokensOut).toBe(150);
    expect(result.llmCall.provider).toBe('openai-mini');
  });
});
