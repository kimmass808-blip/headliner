# @mft/db

Prisma client and migrations for the MFT platform.

## Usage

This package is a monorepo internal. Import via:

```ts
import { prisma } from '@mft/db';
```

## Scripts

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Apply migrations in production
pnpm prisma:migrate

# Create a new migration during development
pnpm prisma:migrate:dev

# Open Prisma Studio (DB browser)
pnpm prisma:studio
```

## Migrations

Two migrations are included:

1. `20260519100000_init` — Full schema DDL for all 11 models.
2. `20260519100100_search_index` — Materialized view `search_index` for full-text search.

> **Important**: Run the Phase 0 search spike (`docs/phase0-search-spike.md`) before applying the `search_index` migration. The spike determines which search engine index to activate (pgroonga or pg_trgm GIN). Uncomment the appropriate index line in the migration SQL before applying.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooled connection URL (used by Prisma at query time) |
| `DIRECT_URL` | Supabase direct connection URL (used by Prisma Migrate) |
