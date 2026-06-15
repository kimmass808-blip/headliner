-- v9: 페스티벌 시리즈(부모) 추가. 전부 가산적(additive) — 기존 데이터 손실 없음.
-- IF NOT EXISTS 가드: 마이그레이션 기록이 실제 DB와 어긋나 있어 db execute로
-- 직접 적용하므로, 재실행/부분적용 상황에서도 안전하도록 멱등하게 작성.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FestivalSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliases" TEXT[],
    "igHandle" TEXT,
    "officialUrl" TEXT,
    "description" TEXT,
    "logoImageUrl" TEXT,
    "defaultVenueId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalSeries_canonicalKey_key" ON "FestivalSeries"("canonicalKey");
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalSeries_igHandle_key" ON "FestivalSeries"("igHandle");
CREATE INDEX IF NOT EXISTS "FestivalSeries_status_idx" ON "FestivalSeries"("status");

-- AlterTable (Festival 부모 연결 칸 — nullable이라 기존 행 영향 없음)
ALTER TABLE "Festival" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
ALTER TABLE "Festival" ADD COLUMN IF NOT EXISTS "editionYear" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Festival_seriesId_idx" ON "Festival"("seriesId");

-- AddForeignKey (DO 블록으로 멱등 처리 — 중복 제약 추가 방지)
DO $$ BEGIN
  ALTER TABLE "FestivalSeries"
    ADD CONSTRAINT "FestivalSeries_defaultVenueId_fkey"
    FOREIGN KEY ("defaultVenueId") REFERENCES "Venue"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Festival"
    ADD CONSTRAINT "Festival_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "FestivalSeries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
