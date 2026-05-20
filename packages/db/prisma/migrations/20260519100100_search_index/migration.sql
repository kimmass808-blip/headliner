-- Phase 0 spike 결과: pgroonga 3.2.5 사용 가능, 채택 (Korean morphology 최선).
-- pg_cron 1.6.4도 사용 가능 — MV refresh를 cron job으로 분리 (별도 SQL).

CREATE EXTENSION IF NOT EXISTS pgroonga;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE MATERIALIZED VIEW search_index AS
SELECT 'show'::text AS kind, s.id::text, s.date::text AS sort_key,
  (coalesce(s.title,'') || ' ' || coalesce(string_agg(a."canonicalName" || ' ' || array_to_string(a.aliases, ' '), ' '), '') || ' ' || coalesce(v.name, '')) AS body
FROM "Show" s
LEFT JOIN "Venue" v ON v.id = s."venueId"
LEFT JOIN "_ShowArtists" sa ON sa."A" = s.id
LEFT JOIN "Artist" a ON a.id = sa."B"
GROUP BY s.id, v.name, s.date, s.title
UNION ALL
SELECT 'festival', f.id::text, f."startDate"::text,
  f.name || ' ' || array_to_string(f.aliases, ' ') || ' ' || coalesce(f."locationText",'')
FROM "Festival" f
UNION ALL
SELECT 'artist', a.id::text, NULL,
  a."canonicalName" || ' ' || array_to_string(a.aliases, ' ')
FROM "Artist" a;

-- Required for CONCURRENTLY refresh
CREATE UNIQUE INDEX search_index_uniq ON search_index (kind, id);

-- pgroonga full-text index (Phase 0 spike에서 채택)
CREATE INDEX search_idx ON search_index USING pgroonga (body);

-- Fallback (현재 미사용, pgroonga에 issue 생기면 활성화):
-- CREATE INDEX search_idx_trgm ON search_index USING gin (body gin_trgm_ops);
