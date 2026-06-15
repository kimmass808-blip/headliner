-- Profile에 약관 동의 기록 칸 추가 (가산적 — 기존 데이터 영향 없음).
-- ADD COLUMN IF NOT EXISTS 로 멱등하게. nullable이라 기존 행도 안전(기존 가입자는 agreedAt=null →
-- 다음 로그인 시 /agree로 유도되어 동의를 받는다). db execute로 직접 적용(프로덕션, reset 금지).

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "agreedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "agreedVersion" TEXT;
