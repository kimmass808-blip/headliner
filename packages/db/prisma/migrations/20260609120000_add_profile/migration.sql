-- v12: Profile — 일반 사용자(페스티벌 관람객) 표시용 프로필 테이블.
-- 새 테이블 생성이라 전부 가산적(additive) — 기존 데이터·테이블과 완전 무관, 손실 없음.
-- id 는 Supabase Auth(auth.users)의 UUID 를 그대로 재사용한다(FK 제약은 걸지 않음 —
-- auth 스키마는 Supabase가 관리하며, public→auth FK 는 권한·삭제순서 문제를 만들 수 있어 피함).
-- IF NOT EXISTS 가드로 멱등하게 작성(재실행/부분적용 안전). db execute로 직접 적용
-- (프로덕션 DB이므로 migrate dev/reset 금지 — CLAUDE.md 안전규칙 준수).

CREATE TABLE IF NOT EXISTS "Profile" (
  "id"        TEXT NOT NULL,
  "nickname"  TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
