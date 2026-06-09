-- v11: IngestSource — ingest 작업 대기열 관측 테이블.
-- 새 테이블 생성이라 전부 가산적(additive) — 기존 데이터와 완전 무관, 손실 없음.
-- IF NOT EXISTS 가드로 멱등하게 작성(재실행/부분적용 안전). db execute로 직접 적용
-- (프로덕션 DB이므로 migrate dev/reset 금지 — CLAUDE.md 안전규칙 준수).

CREATE TABLE IF NOT EXISTS "IngestSource" (
  "igHandle"    TEXT NOT NULL,
  "fullName"    TEXT,
  "kind"        TEXT,
  "status"      TEXT NOT NULL DEFAULT 'collected',
  "fetched"     INTEGER NOT NULL DEFAULT 0,
  "mediaCount"  INTEGER,
  "complete"    BOOLEAN,
  "filePath"    TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "loadedAt"    TIMESTAMP(3),
  "showsLoaded" INTEGER,
  "note"        TEXT,
  CONSTRAINT "IngestSource_pkey" PRIMARY KEY ("igHandle")
);

CREATE INDEX IF NOT EXISTS "IngestSource_status_idx" ON "IngestSource"("status");
CREATE INDEX IF NOT EXISTS "IngestSource_collectedAt_idx" ON "IngestSource"("collectedAt");
