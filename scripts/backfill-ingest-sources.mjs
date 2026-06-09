#!/usr/bin/env node
/* =============================================================================
 * backfill-ingest-sources.mjs — 기존 수집물을 IngestSource(작업 대기열)에 일회성 등록.
 * -----------------------------------------------------------------------------
 * 이 기능을 새로 붙이기 "전에" 이미 쌓인 것들을 어드민에서 보이게 하는 백필.
 *   1) /tmp/full-*.json (그리고 ~/Downloads/full-*.json) 를 훑어 'collected'(대기)로 등록.
 *   2) .omc/ingest-log/*.json (적재 감사 로그)에서 실제 적재된 계정을 찾아 'loaded'(완료)로 도장.
 *      → 이미 적재가 끝난 계정은 대기열이 아니라 완료로 표시된다.
 *
 * 안전: upsert만 사용(행 삭제 없음). 기본은 미리보기(dry). 실제 적용은 --apply.
 *
 * 사용:
 *   node --env-file=.env scripts/backfill-ingest-sources.mjs           # 미리보기
 *   node --env-file=.env scripts/backfill-ingest-sources.mjs --apply   # 실제 등록
 * ============================================================================= */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

const normalize = (h) => String(h || '').trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, '');

// ── 1) 수집 파일 인벤토리 (/tmp, ~/Downloads) ────────────────────────────────
function scanCollected() {
  const dirs = ['/tmp', join(homedir(), 'Downloads')];
  const out = new Map(); // handle -> record
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => /^full-.*\.json$/.test(x))) {
      const p = join(dir, f);
      let data;
      try {
        data = JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        continue;
      }
      const handle = normalize(data.handle ?? f.replace(/^full-|\.json$/g, ''));
      if (!handle) continue;
      const fetched = data.fetched ?? (Array.isArray(data.items) ? data.items.length : 0);
      const mc = typeof data.media_count === 'number' ? data.media_count : null;
      const complete = data.complete ?? (mc == null ? null : fetched >= mc - 3);
      out.set(handle, {
        igHandle: handle,
        fullName: typeof data.full_name === 'string' ? data.full_name : null,
        fetched: Number.isFinite(fetched) ? fetched : 0,
        mediaCount: mc,
        complete: complete == null ? null : Boolean(complete),
        filePath: p,
      });
    }
  }
  return out;
}

// ── 2) 적재 감사 로그에서 'loaded' 계정 추출 ─────────────────────────────────
function scanLoaded() {
  const logDir = join(REPO_ROOT, '.omc', 'ingest-log');
  const loaded = new Map(); // handle -> { loadedAt, showsLoaded }
  if (!existsSync(logDir)) return loaded;
  for (const f of readdirSync(logDir).filter((x) => x.endsWith('.json'))) {
    let a;
    try {
      a = JSON.parse(readFileSync(join(logDir, f), 'utf8'));
    } catch {
      continue;
    }
    if (a.dryRun) continue;
    const handle = normalize(a.source?.accountHandle);
    if (!handle) continue;
    const runAt = a.runAt ? new Date(a.runAt) : null;
    const s = a.stats?.shows;
    const showsLoaded = s ? (s.inserted ?? 0) + (s.updated ?? 0) : null;
    const prev = loaded.get(handle);
    if (!prev || (runAt && prev.loadedAt && runAt > prev.loadedAt) || (runAt && !prev.loadedAt)) {
      loaded.set(handle, { loadedAt: runAt, showsLoaded });
    }
  }
  return loaded;
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL 없음. `node --env-file=.env scripts/backfill-ingest-sources.mjs` 로 실행하세요.');
    process.exit(1);
  }
  const collected = scanCollected();
  const loaded = scanLoaded();

  // 최종 상태 결정: 적재 로그에 있으면 loaded, 아니면 collected.
  const plan = [];
  for (const [handle, rec] of collected) {
    if (loaded.has(handle)) {
      plan.push({ ...rec, status: 'loaded', ...loaded.get(handle) });
    } else {
      plan.push({ ...rec, status: 'collected' });
    }
  }
  // 수집 파일은 없지만 적재 로그에만 있는 계정도 완료로 남겨둔다(파일은 이미 처리돼 지워졌을 수 있음).
  for (const [handle, info] of loaded) {
    if (!collected.has(handle)) {
      plan.push({ igHandle: handle, status: 'loaded', ...info });
    }
  }

  const nPending = plan.filter((p) => p.status === 'collected').length;
  const nLoaded = plan.filter((p) => p.status === 'loaded').length;
  console.log(`발견: 수집파일 ${collected.size}개, 적재로그 계정 ${loaded.size}개`);
  console.log(`등록 예정: ⏳ 대기 ${nPending}  ·  ✅ 완료 ${nLoaded}  (총 ${plan.length})`);

  if (!APPLY) {
    console.log('\n[미리보기] 실제 등록하려면 --apply 를 붙이세요.');
    for (const p of plan.slice(0, 40)) {
      console.log(`  ${p.status === 'loaded' ? '✅' : '⏳'} @${p.igHandle}${p.showsLoaded != null ? ` (show ${p.showsLoaded})` : ''}`);
    }
    if (plan.length > 40) console.log(`  … 외 ${plan.length - 40}개`);
    return;
  }

  const require = createRequire(join(REPO_ROOT, 'packages', 'db', 'package.json'));
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    let n = 0;
    for (const p of plan) {
      const base = {
        fullName: p.fullName ?? null,
        fetched: p.fetched ?? 0,
        mediaCount: p.mediaCount ?? null,
        complete: p.complete ?? null,
        filePath: p.filePath ?? null,
      };
      if (p.status === 'loaded') {
        await prisma.ingestSource.upsert({
          where: { igHandle: p.igHandle },
          create: { igHandle: p.igHandle, ...base, status: 'loaded', loadedAt: p.loadedAt ?? null, showsLoaded: p.showsLoaded ?? null },
          update: { ...base, status: 'loaded', loadedAt: p.loadedAt ?? null, showsLoaded: p.showsLoaded ?? null },
        });
      } else {
        // 대기: 이미 행이 있으면 status는 건드리지 않고 메타데이터만 보정(완료를 대기로 되돌리지 않기 위해).
        await prisma.ingestSource.upsert({
          where: { igHandle: p.igHandle },
          create: { igHandle: p.igHandle, ...base, status: 'collected' },
          update: base,
        });
      }
      n++;
    }
    console.log(`\n적용 완료: ${n}개 upsert.`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
