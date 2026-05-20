/**
 * AC-7, AC-8 검색 인터페이스 — 어댑터 교체 가능하도록 추상화.
 */

export type SearchKind = 'show' | 'festival' | 'artist';

export type ContextMode = 'festival_mode' | 'artist_mode' | 'mixed';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  /** ts_rank 또는 동등한 raw score */
  rawScore: number;
  /** AC-7 v5: completeness 가중 후 최종 score (Show만 적용, 나머지는 rawScore와 동일) */
  finalScore: number;
  /** AC-7 v5 tier-then-rank: completeness=3 → 1, 아니면 0 (Show 외에는 1) */
  tier: 0 | 1;
}

export interface SearchOptions {
  limit?: number;
  /** 결과에 포함할 kind 제한 */
  kinds?: SearchKind[];
}

export interface SearchResponse {
  /** AC-8 context 분기 결과 */
  contextMode: ContextMode;
  /** festival_mode일 때 상단에 노출될 Festival id (단일) */
  primaryFestivalId?: string;
  /** artist_mode일 때 매칭된 Artist id (단일) */
  primaryArtistId?: string;
  results: SearchResult[];
}

export interface SearchEngine {
  /**
   * 단일 호출로 AC-8 컨텍스트 분기·tier-then-rank 모두 적용한 결과 반환.
   * 어댑터가 내부적으로:
   *   1. kind별 top-1 score 수집 → context mode 결정
   *   2. festival_mode일 경우 해당 Festival의 Shows를 결과에서 필터아웃
   *   3. Show 결과는 final_score = ts_rank × completeness_weight로 재계산
   *   4. 2단 정렬 (tier DESC, finalScore DESC)
   */
  search(query: string, opts?: SearchOptions): Promise<SearchResponse>;

  /**
   * 검색 인덱스 재구축 (pg_cron 또는 외부 인덱스 rebuild).
   * AC-19a 시나리오: pg_cron이 정기 호출. 수동 호출도 가능.
   */
  reindex(): Promise<{ refreshedAt: Date; durationMs: number }>;
}
