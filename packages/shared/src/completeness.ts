/**
 * 검색 랭킹용 completeness 가중치 (AC-7)
 * tier-then-rank: 완성(=3)이 항상 미완보다 위.
 * 미완끼리는 multiplicative bias.
 */
export const COMPLETENESS_WEIGHT: Record<0 | 1 | 2 | 3, number> = {
  0: 0,    // 게시 안 됨
  1: 0.5,
  2: 0.75,
  3: 1.0,
};

export function completenessWeight(completeness: number): number {
  if (completeness <= 0) return 0;
  if (completeness === 1) return 0.5;
  if (completeness === 2) return 0.75;
  return 1.0;
}

/**
 * 2단 정렬용 키. completeness=3인 Show가 항상 상위 tier.
 * SQL에서는: ORDER BY (completeness = 3) DESC, final_score DESC
 */
export function completenessTier(completeness: number): 0 | 1 {
  return completeness === 3 ? 1 : 0;
}
