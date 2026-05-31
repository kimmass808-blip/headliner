-- CreateEnum
CREATE TYPE "FestivalInfoCategory" AS ENUM ('MAP', 'TIMETABLE', 'ACCESS', 'RULES', 'FAQ', 'GOODS', 'AMENITY', 'NOTICE');

-- CreateTable
CREATE TABLE "FestivalInfo" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "category" "FestivalInfoCategory" NOT NULL,
    "title" TEXT,
    "imageUrls" TEXT[],
    "bodyText" TEXT,
    "sourcePostUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FestivalInfo_sourcePostUrl_key" ON "FestivalInfo"("sourcePostUrl");

-- CreateIndex
CREATE INDEX "FestivalInfo_festivalId_category_idx" ON "FestivalInfo"("festivalId", "category");

-- CreateIndex
CREATE INDEX "FestivalInfo_status_idx" ON "FestivalInfo"("status");

-- AddForeignKey
ALTER TABLE "FestivalInfo" ADD CONSTRAINT "FestivalInfo_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
