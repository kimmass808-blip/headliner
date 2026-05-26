-- v6: Split Show into Show (named instance) + ShowSession (per-day performance).
-- Legacy columns Show.date / Show.startTime / Show.ticketUrl are retained
-- (deprecated) until read paths finish migrating. firstSessionDate /
-- lastSessionDate are denormalized for sort/filter without join.

-- 1) New ShowSession table
CREATE TABLE "ShowSession" (
    "id"           TEXT NOT NULL,
    "showId"       TEXT NOT NULL,
    "date"         DATE NOT NULL,
    "startTime"    TEXT,
    "endTime"      TEXT,
    "ticketUrl"    TEXT,
    "ticketOpenAt" TIMESTAMP(3),
    "capacity"     INTEGER,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShowSession_showId_date_key" ON "ShowSession"("showId", "date");
CREATE INDEX "ShowSession_date_idx" ON "ShowSession"("date");
CREATE INDEX "ShowSession_showId_idx" ON "ShowSession"("showId");

ALTER TABLE "ShowSession" ADD CONSTRAINT "ShowSession_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Denormalized columns on Show
ALTER TABLE "Show" ADD COLUMN "firstSessionDate" DATE;
ALTER TABLE "Show" ADD COLUMN "lastSessionDate"  DATE;
CREATE INDEX "Show_firstSessionDate_idx" ON "Show"("firstSessionDate");
CREATE INDEX "Show_completeness_firstSessionDate_idx" ON "Show"("completeness", "firstSessionDate");

-- 3) Backfill: 1 Session per existing Show that has a date.
--    Deterministic id ('sess_' + showId) so re-running this migration on
--    fresh dev DBs reproduces the same rows. Single session per show — no
--    multi-session merge happens here; that's Phase 4.
INSERT INTO "ShowSession" ("id", "showId", "date", "startTime", "ticketUrl", "updatedAt")
SELECT
    'sess_' || "id",
    "id",
    "date",
    "startTime",
    "ticketUrl",
    CURRENT_TIMESTAMP
FROM "Show"
WHERE "date" IS NOT NULL;

-- 4) Backfill denormalized date range from Sessions (1-1 for now).
UPDATE "Show" s
SET "firstSessionDate" = "date",
    "lastSessionDate"  = "date"
WHERE "date" IS NOT NULL;
