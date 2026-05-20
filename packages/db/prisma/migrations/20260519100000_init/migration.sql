-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliases" TEXT[],
    "igHandle" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "address" TEXT,
    "region" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueAlias" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,

    CONSTRAINT "VenueAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Festival" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliases" TEXT[],
    "startDate" DATE,
    "endDate" DATE,
    "venueId" TEXT,
    "locationText" TEXT,
    "officialUrl" TEXT,
    "ticketUrl" TEXT,
    "igHandle" TEXT,
    "posterImageUrl" TEXT,
    "description" TEXT,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowMergeLog" (
    "id" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "loserData" JSONB NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedBy" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ShowMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "date" DATE,
    "startTime" TEXT,
    "venueId" TEXT,
    "title" TEXT,
    "originalPostUrl" TEXT NOT NULL,
    "ticketUrl" TEXT,
    "imageUrl" TEXT,
    "rawTextExcerpt" TEXT,
    "festivalId" TEXT,
    "stage" TEXT,
    "setOrder" INTEGER,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "missingFields" TEXT[],
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "fingerprint" TEXT,
    "fingerprintInputs" JSONB,
    "duplicateOfShowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "sourceNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isEncore" BOOLEAN NOT NULL DEFAULT false,
    "coverOf" TEXT,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "canonicalUrl" TEXT NOT NULL,
    "sourceAccount" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "postType" TEXT NOT NULL,
    "extractedShowId" TEXT,
    "extractedFestivalId" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramPost_pkey" PRIMARY KEY ("canonicalUrl")
);

-- CreateTable
CREATE TABLE "SeedAccount" (
    "igHandle" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "sourceSeedHandle" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),
    "lastFetched" TIMESTAMP(3),
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SeedAccount_pkey" PRIMARY KEY ("igHandle")
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "accountsAttempted" INTEGER NOT NULL DEFAULT 0,
    "accountsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "postsFetched" INTEGER NOT NULL DEFAULT 0,
    "postsClassified" INTEGER NOT NULL DEFAULT 0,
    "showsCreated" INTEGER NOT NULL DEFAULT 0,
    "showsUpdated" INTEGER NOT NULL DEFAULT 0,
    "festivalsCreated" INTEGER NOT NULL DEFAULT 0,
    "snowballAdded" INTEGER NOT NULL DEFAULT 0,
    "llmTokensIn" INTEGER NOT NULL DEFAULT 0,
    "llmTokensOut" INTEGER NOT NULL DEFAULT 0,
    "llmCostCents" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errors" JSONB,

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable (implicit many-to-many join table for Show <-> Artist)
CREATE TABLE "_ShowArtists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Artist_canonicalKey_key" ON "Artist"("canonicalKey");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Artist_igHandle_key" ON "Artist"("igHandle");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Venue_canonicalKey_key" ON "Venue"("canonicalKey");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "VenueAlias_alias_key" ON "VenueAlias"("alias");

-- CreateIndex
CREATE INDEX "VenueAlias_canonicalKey_idx" ON "VenueAlias"("canonicalKey");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Festival_canonicalKey_key" ON "Festival"("canonicalKey");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Festival_igHandle_key" ON "Festival"("igHandle");

-- CreateIndex
CREATE INDEX "Festival_startDate_endDate_idx" ON "Festival"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Festival_completeness_idx" ON "Festival"("completeness");

-- CreateIndex
CREATE INDEX "ShowMergeLog_winnerId_idx" ON "ShowMergeLog"("winnerId");

-- CreateIndex
CREATE INDEX "ShowMergeLog_mergedAt_idx" ON "ShowMergeLog"("mergedAt");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Show_originalPostUrl_key" ON "Show"("originalPostUrl");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Show_fingerprint_key" ON "Show"("fingerprint");

-- CreateIndex
CREATE INDEX "Show_date_idx" ON "Show"("date");

-- CreateIndex
CREATE INDEX "Show_festivalId_idx" ON "Show"("festivalId");

-- CreateIndex
CREATE INDEX "Show_completeness_date_idx" ON "Show"("completeness", "date");

-- CreateIndex
CREATE INDEX "Show_duplicateOfShowId_idx" ON "Show"("duplicateOfShowId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Setlist_showId_key" ON "Setlist"("showId");

-- CreateIndex
CREATE INDEX "Song_setlistId_order_idx" ON "Song"("setlistId", "order");

-- CreateIndex
CREATE INDEX "InstagramPost_sourceAccount_postedAt_idx" ON "InstagramPost"("sourceAccount", "postedAt");

-- CreateIndex
CREATE INDEX "SeedAccount_status_lastFetched_idx" ON "SeedAccount"("status", "lastFetched");

-- CreateIndex
CREATE INDEX "CrawlRun_startedAt_idx" ON "CrawlRun"("startedAt");

-- CreateUniqueIndex (join table)
CREATE UNIQUE INDEX "_ShowArtists_AB_unique" ON "_ShowArtists"("A", "B");

-- CreateIndex (join table)
CREATE INDEX "_ShowArtists_B_index" ON "_ShowArtists"("B");

-- AddForeignKey
ALTER TABLE "Festival" ADD CONSTRAINT "Festival_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_duplicateOfShowId_fkey" FOREIGN KEY ("duplicateOfShowId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setlist" ADD CONSTRAINT "Setlist_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShowArtists" ADD CONSTRAINT "_ShowArtists_A_fkey" FOREIGN KEY ("A") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShowArtists" ADD CONSTRAINT "_ShowArtists_B_fkey" FOREIGN KEY ("B") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
