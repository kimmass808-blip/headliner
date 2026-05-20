/**
 * 분류기 단위 테스트 — 실제 LLM API 호출 없음 (mock)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmClient, LlmCallResult } from '../llm-client.js';

// llm-client 모킹 (실제 API 미호출)
vi.mock('../llm-client.js', () => ({
  createLlmClient: vi.fn(),
}));

import { createLlmClient } from '../llm-client.js';
import { classify } from '../classify.js';

function makeMockClient(responseText: string): LlmClient {
  const mockResult: LlmCallResult = {
    text: responseText,
    tokensIn: 100,
    tokensOut: 50,
    costCents: 0,
    model: 'gpt-4o-mini',
    provider: 'openai-mini',
  };
  return {
    call: vi.fn().mockResolvedValue(mockResult),
  };
}

describe('classify()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('single_show 라벨을 올바르게 파싱한다', async () => {
    const mockResponse = JSON.stringify({
      postType: 'single_show',
      confidence: 0.95,
      reasoning: '단일 날짜와 장소가 명시된 단독공연 안내 게시물',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await classify('🎸 단독공연\n일시: 2025-03-15\n장소: 홍대 클럽 FF');

    expect(result.classification.postType).toBe('single_show');
    expect(result.classification.confidence).toBe(0.95);
    expect(result.classification.reasoning).toBeDefined();
    expect(result.llmCall.tokensIn).toBe(100);
  });

  it('festival_lineup 라벨을 올바르게 파싱한다', async () => {
    const mockResponse = JSON.stringify({
      postType: 'festival_lineup',
      confidence: 0.88,
      reasoning: '다수 아티스트 멘션과 Day 1/2 구분이 있는 페스티벌 라인업',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await classify(
      '인디서울 페스티벌\nDAY1: @artist_a @artist_b\nDAY2: @artist_c',
    );

    expect(result.classification.postType).toBe('festival_lineup');
    expect(result.classification.confidence).toBeGreaterThan(0.5);
  });

  it('setlist 라벨을 올바르게 파싱한다', async () => {
    const mockResponse = JSON.stringify({
      postType: 'setlist',
      confidence: 0.99,
      reasoning: '번호 매긴 곡 목록 포함',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await classify('오늘 셋리스트\n1. 곡명A\n2. 곡명B\n3. 곡명C');

    expect(result.classification.postType).toBe('setlist');
  });

  it('unrelated 라벨을 올바르게 파싱한다', async () => {
    const mockResponse = JSON.stringify({
      postType: 'unrelated',
      confidence: 0.92,
      reasoning: '일상 사진 게시물',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await classify('오늘 날씨 너무 좋다 ☀️ #일상 #카페');

    expect(result.classification.postType).toBe('unrelated');
  });

  it('잘못된 JSON 응답 시 에러를 던진다', async () => {
    vi.mocked(createLlmClient).mockReturnValue(makeMockClient('이것은 JSON이 아닙니다'));

    await expect(classify('some text')).rejects.toThrow();
  });

  it('유효하지 않은 postType 시 zod 에러를 던진다', async () => {
    const invalidResponse = JSON.stringify({
      postType: 'unknown_type', // 유효하지 않은 값
      confidence: 0.9,
      reasoning: '테스트',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(invalidResponse));

    await expect(classify('some text')).rejects.toThrow();
  });

  it('confidence 범위 0~1을 벗어나면 zod 에러를 던진다', async () => {
    const invalidResponse = JSON.stringify({
      postType: 'single_show',
      confidence: 1.5, // 범위 초과
      reasoning: '테스트',
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(invalidResponse));

    await expect(classify('some text')).rejects.toThrow();
  });

  it('reasoning 필드가 없어도 파싱된다 (optional)', async () => {
    const mockResponse = JSON.stringify({
      postType: 'unrelated',
      confidence: 0.7,
      // reasoning 없음
    });

    vi.mocked(createLlmClient).mockReturnValue(makeMockClient(mockResponse));

    const result = await classify('some text');

    expect(result.classification.postType).toBe('unrelated');
    expect(result.classification.reasoning).toBeUndefined();
  });
});
