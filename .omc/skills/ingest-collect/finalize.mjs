#!/usr/bin/env node
/* =============================================================================
 * finalize.mjs — 수집 후처리: ~/Downloads/full-*.json → /tmp/ 이동 + 건수 검증
 * -----------------------------------------------------------------------------
 * ingest-collect 의 Step 5. 브라우저가 자동 저장한 계정별 캡션 파일을 작업 폴더로
 * 옮기고, 각 파일의 fetched vs media_count 를 비교해 불완전 수집을 표시한다.
 * 이건 브라우저가 필요 없는 순수 Node 작업이라 일반 스크립트로 둔다.
 *
 * 사용:  node finalize.mjs            # ~/Downloads → /tmp
 *        node finalize.mjs --dest <dir>
 * ============================================================================= */
import { readdirSync, readFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// 레포 루트 = 이 파일(.omc/skills/ingest-collect/finalize.mjs)에서 3단계 위
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

const SRC = flag('src') || join(homedir(), 'Downloads');
const DEST = flag('dest') || '/tmp';
if (!existsSync(DEST)) mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((f) => /^full-.*\.json$/.test(f));
if (!files.length) {
  console.log(`수집 파일 없음 (${SRC}/full-*.json). 브라우저 자동저장이 끝났는지 확인.`);
  process.exit(0);
}

const ok = [];
const incomplete = [];
const bad = [];
const records = []; // DB(IngestSource)에 등록할 수집물

for (const f of files) {
  const srcPath = join(SRC, f);
  let data;
  try {
    data = JSON.parse(readFileSync(srcPath, 'utf8'));
  } catch (e) {
    bad.push(`${f}: parse 실패 (${e.message})`);
    continue;
  }
  const destPath = join(DEST, f);
  renameSync(srcPath, destPath);

  const handle = data.handle ?? f.replace(/^full-|\.json$/g, '');
  const fetched = data.fetched ?? (Array.isArray(data.items) ? data.items.length : 0);
  const mc = data.media_count ?? null;
  const complete = data.complete ?? (mc == null ? null : fetched >= mc - 3);
  const line = `${handle}: ${fetched}/${mc ?? '?'}`;

  if (complete === false) incomplete.push(line);
  else ok.push(line);

  records.push({
    igHandle: handle,
    fullName: typeof data.full_name === 'string' ? data.full_name : null,
    fetched: Number.isFinite(fetched) ? fetched : 0,
    mediaCount: typeof mc === 'number' ? mc : null,
    complete: complete === null ? null : Boolean(complete),
    filePath: destPath,
  });
}

// ── DB 등록: 수집한 계정을 IngestSource 에 'collected'(처리 대기)로 upsert ──────────
// /admin/ingest 가 이걸 읽어 "처리할 JSON 목록"을 보여준다. 같은 계정을 다시 수집하면
// status를 'collected'로 되돌리고 loadedAt을 비워 재처리 신호를 준다.
// DB 실패는 파일 이동(핵심 작업)을 막지 않는다 — 경고만 남기고 넘어간다.
async function registerToDb() {
  if (!records.length) return;
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.log('\n⚠️ DB 등록 건너뜀: DATABASE_URL 없음(.env 미발견). 파일 이동은 완료됨.');
    return;
  }
  let prisma;
  try {
    const require = createRequire(join(REPO_ROOT, 'packages', 'db', 'package.json'));
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  } catch (e) {
    console.log(`\n⚠️ DB 등록 건너뜀: Prisma 로드 실패 (${e.message}). 파일 이동은 완료됨.`);
    return;
  }
  try {
    for (const r of records) {
      await prisma.ingestSource.upsert({
        where: { igHandle: r.igHandle },
        create: { ...r, status: 'collected' },
        update: {
          fullName: r.fullName,
          fetched: r.fetched,
          mediaCount: r.mediaCount,
          complete: r.complete,
          filePath: r.filePath,
          status: 'collected',
          collectedAt: new Date(),
          loadedAt: null,
          showsLoaded: null,
        },
      });
    }
    console.log(`\n📥 DB 등록(IngestSource): ${records.length}개 계정 → 'collected'(처리 대기)`);
  } catch (e) {
    console.log(`\n⚠️ DB 등록 실패 (${e.message}). 파일 이동은 완료됨 — 나중에 재시도 가능.`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// .env(KEY=value) 를 process.env 로 로드 — 간단 파서(따옴표 제거).
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

console.log(`\n=== 수집 후처리 완료: ${SRC} → ${DEST} ===`);
console.log(`이동: ${files.length}개\n`);
if (ok.length) { console.log(`✅ 완전 수집 (${ok.length}):`); ok.forEach((l) => console.log('   ' + l)); }
if (incomplete.length) {
  console.log(`\n⚠️ 불완전 — 재수집 필요 (${incomplete.length}):`);
  incomplete.forEach((l) => console.log('   ' + l));
}
if (bad.length) {
  console.log(`\n❌ 손상 파일 (${bad.length}):`);
  bad.forEach((l) => console.log('   ' + l));
}
await registerToDb();

console.log(`\n다음: ingest-show 스킬로 /tmp/full-<handle>.json 을 분류·적재 (사람 감독).`);
