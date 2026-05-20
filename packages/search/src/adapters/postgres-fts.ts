/**
 * Postgres FTS 어댑터 — pgroonga 또는 pg_trgm 엔진 (ENV로 분기).
 *
 * Phase 0 spike(`docs/phase0-search-spike.md`) 결과에 따라
 * `SEARCH_ENGINE` 환경 변수로 엔진 선택:
 *   - `pgroonga` (preferred, Korean morphology)
 *   - `pg_trgm` (fallback, Supabase 기본)
 *
 * AC-7 (랭킹): `final_score = ts_rank × completeness_weight`, 2단 정렬 (tier DESC, final DESC)
 * AC-8 (컨텍스트 적응): kind별 top-1 score 수집 → 1.5× tie-break + token 매칭 게이트
 */

import { prisma } from '@mft/db';
import { completenessWeight, completenessTier } from '@mft/shared';
import type {
  SearchEngine,
  SearchResponse,
  SearchResult,
  SearchOptions,
  ContextMode,
} from '../types.js';

type Engine = 'pgroonga' | 'pg_trgm';

function resolveEngine(): Engine {
  const v = (process.env.SEARCH_ENGINE ?? 'pg_trgm').toLowerCase();
  if (v === 'pgroonga') return 'pgroonga';
  return 'pg_trgm';
}

/**
 * 엔진별 raw SQL fragment 생성.
 * `body` 컬럼에 대해 검색 + rank 점수 반환.
 */
function buildSelectByKind(engine: Engine, kind: 'show' | 'festival' | 'artist') {
  if (engine === 'pgroonga') {
    // pgroonga: body &@~ '$1' (양방향 부분 매칭)
    return {
      where: `kind = '${kind}' AND body &@~ $1`,
      // pgroonga_score는 pgroonga 함수. ctid가 필요해서 row level에서 호출.
      rankExpr: `pgroonga_score(tableoid, ctid)`,
    };
  }
  // pg_trgm: similarity(body, $1) — 0~1 float. WHERE %는 trigram threshold.
  return {
    where: `kind = '${kind}' AND body % $1`,
    rankExpr: `similarity(body, $1)`,
  };
}

interface RawSearchRow {
  kind: 'show' | 'festival' | 'artist';
  id: string;
  raw_score: number;
}

async function rawSearchByKind(
  engine: Engine,
  query: string,
  kind: 'show' | 'festival' | 'artist',
  limit: number
): Promise<RawSearchRow[]> {
  const { where, rankExpr } = buildSelectByKind(engine, kind);
  // search_index materialized view 사용
  const sql = `
    SELECT kind, id, ${rankExpr}::float AS raw_score
    FROM search_index
    WHERE ${where}
    ORDER BY raw_score DESC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  `;
  return await prisma.$queryRawUnsafe<RawSearchRow[]>(sql, query);
}

/**
 * AC-8 token 매칭 게이트:
 * 쿼리 token이 entity.canonicalKey 또는 aliases와 부분 매칭하는지.
 * 단순 lowercase substring check (한국어 형태소까지는 안 봄 — V1에선 충분).
 */
function tokenMatches(query: string, candidates: string[]): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  return candidates.some((c) => {
    if (!c) return false;
    const lc = c.toLowerCase();
    return lc.includes(q) || q.includes(lc);
  });
}

async function fetchFestivalTokens(festivalId: string): Promise<string[]> {
  const f = await prisma.festival.findUnique({
    where: { id: festivalId },
    select: { name: true, canonicalKey: true, aliases: true },
  });
  return f ? [f.name, f.canonicalKey, ...f.aliases] : [];
}

async function fetchArtistTokens(artistId: string): Promise<string[]> {
  const a = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { canonicalName: true, canonicalKey: true, aliases: true },
  });
  return a ? [a.canonicalName, a.canonicalKey, ...a.aliases] : [];
}

/**
 * AC-7: Show 결과의 final_score = ts_rank × completeness_weight.
 * tier = completeness === 3 ? 1 : 0 (2단 정렬용).
 */
async function shapeShowResults(rows: RawSearchRow[]): Promise<SearchResult[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const shows = await prisma.show.findMany({
    where: { id: { in: ids } },
    select: { id: true, completeness: true },
  });
  const completenessById = new Map(shows.map((s) => [s.id, s.completeness]));
  return rows.map((r) => {
    const c = completenessById.get(r.id) ?? 0;
    const w = completenessWeight(c);
    return {
      kind: 'show' as const,
      id: r.id,
      rawScore: r.raw_score,
      finalScore: r.raw_score * w,
      tier: completenessTier(c),
    };
  });
}

function shapeFestivalResults(rows: RawSearchRow[]): SearchResult[] {
  return rows.map((r) => ({
    kind: 'festival',
    id: r.id,
    rawScore: r.raw_score,
    finalScore: r.raw_score, // Festival·Artist는 completeness 가중 미적용
    tier: 1,
  }));
}

function shapeArtistResults(rows: RawSearchRow[]): SearchResult[] {
  return rows.map((r) => ({
    kind: 'artist',
    id: r.id,
    rawScore: r.raw_score,
    finalScore: r.raw_score,
    tier: 1,
  }));
}

/**
 * AC-8 컨텍스트 분기:
 *   festival.top.score > artist.top.score * 1.5 AND token이 festival에 매칭 → festival_mode
 *   artist.top.score > festival.top.score * 1.5 AND token이 artist에 매칭 → artist_mode
 *   그 외 → mixed
 */
async function decideContextMode(
  query: string,
  showRows: RawSearchRow[],
  festivalRows: RawSearchRow[],
  artistRows: RawSearchRow[]
): Promise<{
  contextMode: ContextMode;
  primaryFestivalId?: string;
  primaryArtistId?: string;
}> {
  const fTop = festivalRows[0];
  const aTop = artistRows[0];
  const fScore = fTop?.raw_score ?? 0;
  const aScore = aTop?.raw_score ?? 0;

  if (fTop && fScore > aScore * 1.5) {
    const tokens = await fetchFestivalTokens(fTop.id);
    if (tokenMatches(query, tokens)) {
      return { contextMode: 'festival_mode', primaryFestivalId: fTop.id };
    }
  }
  if (aTop && aScore > fScore * 1.5) {
    const tokens = await fetchArtistTokens(aTop.id);
    if (tokenMatches(query, tokens)) {
      return { contextMode: 'artist_mode', primaryArtistId: aTop.id };
    }
  }
  return { contextMode: 'mixed' };
}

async function filterFestivalChildren(
  results: SearchResult[],
  festivalId: string
): Promise<SearchResult[]> {
  const showIds = results.filter((r) => r.kind === 'show').map((r) => r.id);
  if (showIds.length === 0) return results;
  const showsToFilter = await prisma.show.findMany({
    where: { id: { in: showIds }, festivalId },
    select: { id: true },
  });
  const filtered = new Set(showsToFilter.map((s) => s.id));
  return results.filter((r) => !(r.kind === 'show' && filtered.has(r.id)));
}

export class PostgresFtsEngine implements SearchEngine {
  private engine: Engine;

  constructor(engine?: Engine) {
    this.engine = engine ?? resolveEngine();
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { contextMode: 'mixed', results: [] };
    }
    const limit = opts.limit ?? 30;
    const kinds = opts.kinds ?? ['show', 'festival', 'artist'];

    // kind별 독립 쿼리 (AC-8)
    const [showRows, festivalRows, artistRows] = await Promise.all([
      kinds.includes('show') ? rawSearchByKind(this.engine, trimmed, 'show', limit) : Promise.resolve([]),
      kinds.includes('festival') ? rawSearchByKind(this.engine, trimmed, 'festival', limit) : Promise.resolve([]),
      kinds.includes('artist') ? rawSearchByKind(this.engine, trimmed, 'artist', limit) : Promise.resolve([]),
    ]);

    // 컨텍스트 모드 결정
    const ctx = await decideContextMode(trimmed, showRows, festivalRows, artistRows);

    // 결과 shape + completeness 가중치 적용
    const [showResults, festivalResults, artistResults] = await Promise.all([
      shapeShowResults(showRows),
      Promise.resolve(shapeFestivalResults(festivalRows)),
      Promise.resolve(shapeArtistResults(artistRows)),
    ]);

    let combined: SearchResult[] = [...showResults, ...festivalResults, ...artistResults];

    // festival_mode: 해당 Festival의 children Show 결과에서 필터아웃
    if (ctx.contextMode === 'festival_mode' && ctx.primaryFestivalId) {
      combined = await filterFestivalChildren(combined, ctx.primaryFestivalId);
    }

    // 2단 정렬 (AC-7 v5 tier-then-rank)
    combined.sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;
      return b.finalScore - a.finalScore;
    });

    return {
      contextMode: ctx.contextMode,
      primaryFestivalId: ctx.primaryFestivalId,
      primaryArtistId: ctx.primaryArtistId,
      results: combined.slice(0, limit),
    };
  }

  async reindex(): Promise<{ refreshedAt: Date; durationMs: number }> {
    const start = Date.now();
    // CONCURRENTLY는 unique index 필수 — packages/db migration에서 정의됨.
    await prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY search_index'
    );
    const durationMs = Date.now() - start;
    return { refreshedAt: new Date(), durationMs };
  }
}

export const postgresFtsEngine = new PostgresFtsEngine();
