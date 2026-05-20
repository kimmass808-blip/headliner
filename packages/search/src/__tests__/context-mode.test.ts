/**
 * AC-8 컨텍스트 분기 단위 테스트.
 * prisma는 mock — 실제 DB 호출 없이 로직만 검증.
 *
 * 본 테스트는 PostgresFtsEngine의 private 함수를 직접 못 부르므로
 * 분기 의도를 행동(외부 효과)으로만 검증. 자세한 단위는 Phase 2.7 통합 테스트로.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@mft/db', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    show: { findMany: vi.fn().mockResolvedValue([]) },
    festival: { findUnique: vi.fn() },
    artist: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@mft/db';
import { PostgresFtsEngine } from '../adapters/postgres-fts.js';

describe('PostgresFtsEngine — context mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('festival_mode: festival score > artist score × 1.5 AND token 매칭 시', async () => {
    // show, festival, artist 순으로 호출되는 3개의 $queryRawUnsafe 모킹
    (prisma.$queryRawUnsafe as any)
      .mockResolvedValueOnce([]) // show
      .mockResolvedValueOnce([{ kind: 'festival', id: 'fest-1', raw_score: 0.9 }]) // festival
      .mockResolvedValueOnce([{ kind: 'artist', id: 'art-1', raw_score: 0.3 }]); // artist

    (prisma.festival.findUnique as any).mockResolvedValue({
      name: '그랜드민트페스티벌',
      canonicalKey: 'grand_mint_festival',
      aliases: ['GMF'],
    });

    const engine = new PostgresFtsEngine('pg_trgm');
    const res = await engine.search('그랜드민트');

    expect(res.contextMode).toBe('festival_mode');
    expect(res.primaryFestivalId).toBe('fest-1');
  });

  it('artist_mode: artist score > festival × 1.5 AND token 매칭 시', async () => {
    (prisma.$queryRawUnsafe as any)
      .mockResolvedValueOnce([]) // show
      .mockResolvedValueOnce([{ kind: 'festival', id: 'fest-1', raw_score: 0.2 }])
      .mockResolvedValueOnce([{ kind: 'artist', id: 'art-1', raw_score: 0.9 }]);

    (prisma.artist.findUnique as any).mockResolvedValue({
      canonicalName: '잔나비',
      canonicalKey: '잔나비',
      aliases: ['JANNABI'],
    });

    const engine = new PostgresFtsEngine('pg_trgm');
    const res = await engine.search('잔나비');

    expect(res.contextMode).toBe('artist_mode');
    expect(res.primaryArtistId).toBe('art-1');
  });

  it('mixed: 두 score가 비슷할 때', async () => {
    (prisma.$queryRawUnsafe as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ kind: 'festival', id: 'f', raw_score: 0.5 }])
      .mockResolvedValueOnce([{ kind: 'artist', id: 'a', raw_score: 0.5 }]);

    const engine = new PostgresFtsEngine('pg_trgm');
    const res = await engine.search('홍대');

    expect(res.contextMode).toBe('mixed');
  });

  it('빈 쿼리는 빈 결과', async () => {
    const engine = new PostgresFtsEngine('pg_trgm');
    const res = await engine.search('   ');
    expect(res.results).toEqual([]);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
