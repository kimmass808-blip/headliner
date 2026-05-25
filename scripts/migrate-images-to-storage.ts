/**
 * Migrate existing Festival.posterImageUrl and Show.imageUrl values from
 * external CDNs (festivallife, instagram, etc.) to Supabase Storage.
 *
 * Steps:
 *   1. collect all distinct external URLs from both tables
 *   2. for each: download -> webp@<=1200px -> upload (idempotent by content hash)
 *   3. update DB rows that referenced the external URL to use the public URL
 *   4. on failure, keep the original URL untouched (so the page still works)
 *   5. write audit log to .omc/image-migration/{ts}.json
 *
 * Concurrency is configurable via env CONC (default 4). Re-running skips URLs
 * already mapped to the supabase.co host.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { pipeImage } from './lib/posters';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const CONCURRENCY = Number(process.env.CONC || 4);
const SUPABASE_HOST = (process.env.SUPABASE_URL || '').replace(/^https?:\/\//, '');

function isAlreadyMigrated(url: string | null): boolean {
  if (!url) return true;
  return !!SUPABASE_HOST && url.includes(SUPABASE_HOST);
}

type Job = { sourceUrl: string; festivalIds: string[]; showIds: string[] };

async function buildJobs(): Promise<Job[]> {
  const fests = await prisma.festival.findMany({
    where: { posterImageUrl: { not: null } },
    select: { id: true, posterImageUrl: true },
  });
  const shows = await prisma.show.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true },
  });
  const map = new Map<string, Job>();
  for (const f of fests) {
    const u = f.posterImageUrl!;
    if (isAlreadyMigrated(u)) continue;
    if (!map.has(u)) map.set(u, { sourceUrl: u, festivalIds: [], showIds: [] });
    map.get(u)!.festivalIds.push(f.id);
  }
  for (const s of shows) {
    const u = s.imageUrl!;
    if (isAlreadyMigrated(u)) continue;
    if (!map.has(u)) map.set(u, { sourceUrl: u, festivalIds: [], showIds: [] });
    map.get(u)!.showIds.push(s.id);
  }
  return [...map.values()];
}

type Result = {
  sourceUrl: string;
  publicUrl?: string;
  origBytes?: number;
  webpBytes?: number;
  width?: number;
  height?: number;
  festivalIds: string[];
  showIds: string[];
  error?: string;
};

async function runOne(job: Job): Promise<Result> {
  try {
    const { publicUrl, normalized } = await pipeImage(job.sourceUrl);
    // Update DB rows
    if (job.festivalIds.length > 0) {
      await prisma.festival.updateMany({
        where: { id: { in: job.festivalIds } },
        data: { posterImageUrl: publicUrl },
      });
    }
    if (job.showIds.length > 0) {
      await prisma.show.updateMany({
        where: { id: { in: job.showIds } },
        data: { imageUrl: publicUrl },
      });
    }
    return {
      sourceUrl: job.sourceUrl,
      publicUrl,
      origBytes: normalized.origBytes,
      webpBytes: normalized.buffer.length,
      width: normalized.width,
      height: normalized.height,
      festivalIds: job.festivalIds,
      showIds: job.showIds,
    };
  } catch (e) {
    return {
      sourceUrl: job.sourceUrl,
      festivalIds: job.festivalIds,
      showIds: job.showIds,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  console.log(`Building job list (concurrency=${CONCURRENCY})...`);
  const jobs = await buildJobs();
  console.log(`Distinct external URLs to migrate: ${jobs.length}`);
  if (jobs.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let done = 0;
  let succeeded = 0;
  let failed = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  const results: Result[] = [];

  const runner = async (job: Job) => {
    const r = await runOne(job);
    results.push(r);
    done++;
    if (r.error) {
      failed++;
    } else {
      succeeded++;
      bytesIn += r.origBytes ?? 0;
      bytesOut += r.webpBytes ?? 0;
    }
    if (done % 25 === 0 || done === jobs.length) {
      console.log(
        `  ${done}/${jobs.length}  ok=${succeeded}  fail=${failed}  ` +
          `in=${(bytesIn / 1024 / 1024).toFixed(1)}MB out=${(bytesOut / 1024 / 1024).toFixed(1)}MB`,
      );
    }
    return r;
  };

  await runWithConcurrency(jobs, CONCURRENCY, runner);

  // audit log
  const logDir = resolve(process.cwd(), '.omc', 'image-migration');
  mkdirSync(logDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(logDir, `${ts}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        concurrency: CONCURRENCY,
        totals: { jobs: jobs.length, succeeded, failed, bytesIn, bytesOut },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nDone.`);
  console.log(`  succeeded: ${succeeded}`);
  console.log(`  failed:    ${failed}`);
  console.log(`  size in:   ${(bytesIn / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  size out:  ${(bytesOut / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  audit log: ${logPath}`);

  if (failed) {
    console.log(`\nFirst 5 failures:`);
    for (const r of results.filter((r) => r.error).slice(0, 5)) {
      console.log(`  ${r.sourceUrl}\n    ${r.error}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
