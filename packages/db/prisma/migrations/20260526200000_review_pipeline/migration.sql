-- v7: Human-in-the-loop review pipeline.
-- - 모든 ingest 신규 row는 ReviewStatus.PENDING으로 들어옴.
-- - 운영자가 /admin/review에서 APPROVED 또는 REJECTED로 transition.
-- - 사이트 public 쿼리는 status = 'APPROVED'만 노출.
-- - ReviewLog는 편집·승인 이력을 누적해 학습 신호로 사용.

-- 1. enum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. Show 컬럼 추가
ALTER TABLE "Show"
  ADD COLUMN "status"        "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedAt"    TIMESTAMP(3),
  ADD COLUMN "reviewedBy"    TEXT,
  ADD COLUMN "reviewerNote"  TEXT;

CREATE INDEX "Show_status_idx" ON "Show"("status");
CREATE INDEX "Show_status_firstSessionDate_idx" ON "Show"("status", "firstSessionDate");

-- 3. Festival 컬럼 추가
ALTER TABLE "Festival"
  ADD COLUMN "status"        "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedAt"    TIMESTAMP(3),
  ADD COLUMN "reviewedBy"    TEXT,
  ADD COLUMN "reviewerNote"  TEXT;

CREATE INDEX "Festival_status_idx" ON "Festival"("status");

-- 4. ReviewLog 테이블 신설
CREATE TABLE "ReviewLog" (
  "id"            TEXT NOT NULL,
  "entityType"    TEXT NOT NULL,
  "entityId"      TEXT NOT NULL,
  "field"         TEXT,
  "oldValue"      JSONB,
  "newValue"      JSONB,
  "action"        TEXT NOT NULL,
  "source"        TEXT NOT NULL,
  "ingestRunPath" TEXT,
  "reviewerId"    TEXT,
  "reviewerNote"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReviewLog_entityType_entityId_idx" ON "ReviewLog"("entityType", "entityId");
CREATE INDEX "ReviewLog_createdAt_idx" ON "ReviewLog"("createdAt");
CREATE INDEX "ReviewLog_action_idx" ON "ReviewLog"("action");

-- 5. search_index 재생성 — status = 'APPROVED'만 포함
-- pgroonga 인덱스도 같이 재생성됨.
DROP MATERIALIZED VIEW IF EXISTS search_index;

CREATE MATERIALIZED VIEW search_index AS
SELECT 'show'::text AS kind, s.id::text, s.date::text AS sort_key,
  (coalesce(s.title,'') || ' ' || coalesce(string_agg(a."canonicalName" || ' ' || array_to_string(a.aliases, ' '), ' '), '') || ' ' || coalesce(v.name, '')) AS body
FROM "Show" s
LEFT JOIN "Venue" v ON v.id = s."venueId"
LEFT JOIN "_ShowArtists" sa ON sa."A" = s.id
LEFT JOIN "Artist" a ON a.id = sa."B"
WHERE s."status" = 'APPROVED'
GROUP BY s.id, v.name, s.date, s.title
UNION ALL
SELECT 'festival', f.id::text, f."startDate"::text,
  f.name || ' ' || array_to_string(f.aliases, ' ') || ' ' || coalesce(f."locationText",'')
FROM "Festival" f
WHERE f."status" = 'APPROVED'
UNION ALL
SELECT 'artist', a.id::text, NULL,
  a."canonicalName" || ' ' || array_to_string(a.aliases, ' ')
FROM "Artist" a;

CREATE UNIQUE INDEX search_index_uniq ON search_index (kind, id);
CREATE INDEX search_idx ON search_index USING pgroonga (body);
