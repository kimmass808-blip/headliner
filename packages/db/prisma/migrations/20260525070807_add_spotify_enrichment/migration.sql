-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "bioText" TEXT,
ADD COLUMN     "externalLinks" JSONB,
ADD COLUMN     "followerCount" INTEGER,
ADD COLUMN     "genres" TEXT[],
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "popularity" INTEGER,
ADD COLUMN     "spotifyId" TEXT,
ADD COLUMN     "spotifyImageUrl" TEXT;

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "durationMs" INTEGER,
    "releaseDate" DATE,
    "isrc" TEXT,
    "spotifyId" TEXT,
    "previewUrl" TEXT,
    "albumName" TEXT,
    "albumImageUrl" TEXT,
    "albumImageRaw" TEXT,
    "popularity" INTEGER,
    "trackNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyMatchCandidate" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "spotifyName" TEXT NOT NULL,
    "popularity" INTEGER,
    "genres" TEXT[],
    "imageUrl" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotifyMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_isrc_key" ON "Track"("isrc");

-- CreateIndex
CREATE UNIQUE INDEX "Track_spotifyId_key" ON "Track"("spotifyId");

-- CreateIndex
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");

-- CreateIndex
CREATE INDEX "Track_releaseDate_idx" ON "Track"("releaseDate");

-- CreateIndex
CREATE INDEX "SpotifyMatchCandidate_artistId_rank_idx" ON "SpotifyMatchCandidate"("artistId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_spotifyId_key" ON "Artist"("spotifyId");

-- CreateIndex
CREATE INDEX "Artist_spotifyId_idx" ON "Artist"("spotifyId");

-- CreateIndex
CREATE INDEX "Artist_popularity_idx" ON "Artist"("popularity");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifyMatchCandidate" ADD CONSTRAINT "SpotifyMatchCandidate_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

