-- v10: seedAccount 큐레이션 구분 칸 추가. 전부 가산적(additive) — 기존 데이터 손실 없음.
-- 페이지가 'band' 위주로 노출하기 위한 워치리스트 단계 분류용.
-- IF NOT EXISTS 가드: 마이그레이션 기록이 실제 DB와 어긋나 있어 db execute로
-- 직접 적용하므로, 재실행/부분적용 상황에서도 안전하도록 멱등하게 작성.

-- AlterTable (둘 다 nullable이라 기존 행 영향 없음)
ALTER TABLE "SeedAccount" ADD COLUMN IF NOT EXISTS "artistType" TEXT; -- 'band' | 'rapper' | 'other'
ALTER TABLE "SeedAccount" ADD COLUMN IF NOT EXISTS "origin" TEXT;     -- 'domestic' | 'overseas'

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SeedAccount_artistType_idx" ON "SeedAccount"("artistType");
