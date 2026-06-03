-- Additive: add TICKET and PROMO to FestivalInfoCategory enum.
-- Safe on Postgres 12+ (Supabase) — ADD VALUE only, no use within this tx, no reset.
ALTER TYPE "FestivalInfoCategory" ADD VALUE IF NOT EXISTS 'TICKET';
ALTER TYPE "FestivalInfoCategory" ADD VALUE IF NOT EXISTS 'PROMO';
