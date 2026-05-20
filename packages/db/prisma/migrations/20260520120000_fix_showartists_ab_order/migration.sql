-- Fix _ShowArtists A/B column ordering to match Prisma's convention.
-- Prisma generates the implicit M2M join table with columns named after the
-- two models in *alphabetical order*: A -> Artist, B -> Show.
-- Our init migration had them flipped (A -> Show, B -> Artist), which made
-- prisma.show.findFirst({ include: { artists } }) and the inverse return
-- empty arrays because Prisma was looking for show ids in column A but the
-- data was in B (and vice versa). Raw SQL access worked because we picked
-- the right column manually.
--
-- This migration:
--   1. drops the existing FK constraints + indexes
--   2. swaps the data in columns A and B
--   3. re-points the FK constraints (A -> Artist, B -> Show)
--   4. recreates the unique and helper indexes

BEGIN;

ALTER TABLE "_ShowArtists" DROP CONSTRAINT "_ShowArtists_A_fkey";
ALTER TABLE "_ShowArtists" DROP CONSTRAINT "_ShowArtists_B_fkey";
DROP INDEX IF EXISTS "_ShowArtists_AB_unique";
DROP INDEX IF EXISTS "_ShowArtists_B_index";

-- swap A and B data via a temporary column rename. This avoids row-level
-- UPDATE which would burn one tuple per row and double bloat on a large MV.
ALTER TABLE "_ShowArtists" RENAME COLUMN "A" TO "tmp_swap";
ALTER TABLE "_ShowArtists" RENAME COLUMN "B" TO "A";
ALTER TABLE "_ShowArtists" RENAME COLUMN "tmp_swap" TO "B";

ALTER TABLE "_ShowArtists"
  ADD CONSTRAINT "_ShowArtists_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Artist"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "_ShowArtists"
  ADD CONSTRAINT "_ShowArtists_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Show"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX "_ShowArtists_AB_unique" ON "_ShowArtists"("A", "B");
CREATE INDEX "_ShowArtists_B_index" ON "_ShowArtists"("B");

COMMIT;
