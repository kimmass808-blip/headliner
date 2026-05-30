/**
 * review-learn — ReviewLog → 학습 신호 반영기.
 *
 * 크롤/ingest 배치 시작 시 1회 실행한다. /admin/review 에서 사람이 가한 교정
 * (ReviewLog 의 edit/reject 행)을 읽어:
 *   1. WRONG(ingest 출력) → RIGHT(사람 교정) 차이를 한 줄 lesson 으로 만들어
 *      .omc/skills/ingest-show/CORRECTIONS.md 백로그에 append (LLM ingest-show
 *      스킬이 다음 패스에서 읽음).
 *   2. 아티스트·베뉴 "이름 1:1 치환" 교정은 결정적 맵
 *      .omc/skills/ingest-show/correction-map.json 에 누적 (ingest.ts 가
 *      canonicalize 단계에서 강제 적용).
 *
 * 멱등: 마지막으로 처리한 ReviewLog.createdAt 를 .learn-state.json 에 저장하고,
 * 그 이후 행만 증분 처리한다. --all 로 전체 재처리, --dry-run 으로 미저장.
 *
 * Usage:
 *   pnpm tsx scripts/review-learn.ts
 *   pnpm tsx scripts/review-learn.ts --all --dry-run
 *   (권장: ./scripts/run-review-learn.sh  — nvm/.env 보장)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { canonicalizeArtistName, canonicalizeVenueText } from '@mft/canonicalize';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set (run via ./scripts/run-review-learn.sh)');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const DRY = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');

const SKILL_DIR = resolve(process.cwd(), '.omc', 'skills', 'ingest-show');
const CORRECTIONS = resolve(SKILL_DIR, 'CORRECTIONS.md');
const MAP_PATH = resolve(SKILL_DIR, 'correction-map.json');
const STATE_PATH = resolve(SKILL_DIR, '.learn-state.json');

const PROMOTE_THRESHOLD = 3;

// ---------- correction map ----------

type MapEntry = { to: string; count: number; lastSeen: string };
type CorrectionMap = {
  version: number;
  updatedAt: string;
  artists: Record<string, MapEntry>;
  venues: Record<string, MapEntry>;
};

function loadMap(): CorrectionMap {
  if (existsSync(MAP_PATH)) {
    try {
      const m = JSON.parse(readFileSync(MAP_PATH, 'utf-8'));
      return { version: 1, updatedAt: m.updatedAt ?? '', artists: m.artists ?? {}, venues: m.venues ?? {} };
    } catch {
      /* fall through to fresh */
    }
  }
  return { version: 1, updatedAt: '', artists: {}, venues: {} };
}

function bumpMap(
  bucket: Record<string, MapEntry>,
  wrongKey: string,
  rightDisplay: string,
  when: string,
): boolean {
  if (!wrongKey || !rightDisplay) return false;
  const cur = bucket[wrongKey];
  if (cur && cur.to === rightDisplay) {
    cur.count += 1;
    cur.lastSeen = when;
  } else {
    // new mapping (or target changed → latest human wins, count resets)
    bucket[wrongKey] = { to: rightDisplay, count: 1, lastSeen: when };
  }
  return true;
}

// ---------- diff helpers ----------

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 배열 1:1 치환 감지: 정확히 하나 빠지고 하나 추가됐을 때만 rename 으로 본다. */
function oneToOneSwap(oldArr: string[], newArr: string[]): { from: string; to: string } | null {
  const removed = oldArr.filter((x) => !newArr.includes(x));
  const added = newArr.filter((x) => !oldArr.includes(x));
  if (removed.length === 1 && added.length === 1) return { from: removed[0], to: added[0] };
  return null;
}

type Lesson = string;

function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(norm).filter(Boolean) : [];
}

// ---------- main ----------

async function main() {
  const state: { lastCreatedAt: string | null } = (() => {
    if (!ALL && existsSync(STATE_PATH)) {
      try {
        return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
      } catch {
        /* ignore */
      }
    }
    return { lastCreatedAt: null };
  })();

  const rows = await prisma.reviewLog.findMany({
    where: {
      source: 'admin',
      action: { in: ['edit', 'reject'] },
      ...(state.lastCreatedAt ? { createdAt: { gt: new Date(state.lastCreatedAt) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  });

  console.log(`review-learn: ${rows.length} new ReviewLog row(s) since ${state.lastCreatedAt ?? '(beginning)'}`);
  if (rows.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const map = loadMap();
  const lessons: Lesson[] = [];
  let mapHits = 0;
  let maxCreatedAt = state.lastCreatedAt;

  for (const r of rows) {
    const when = ymd(r.createdAt);
    maxCreatedAt = r.createdAt.toISOString();
    const tag = `${r.entityType}:${r.entityId.slice(0, 8)}`;

    if (r.action === 'reject') {
      const reason = r.reviewerNote?.trim();
      lessons.push(
        `- [${when}] [${tag}] REJECTED. reason: ${reason || '(없음)'}. CAUSE: ingest 가 부적합 항목을 통과시킴. RULE: pending.`,
      );
      continue;
    }

    // action === 'edit'
    const oldV = (r.oldValue ?? {}) as Record<string, unknown>;
    const newV = (r.newValue ?? {}) as Record<string, unknown>;
    if (!r.oldValue) {
      // 구버전 로그(oldValue 미기록) — 차이 산출 불가. 한 줄만 남긴다.
      lessons.push(`- [${when}] [${tag}] EDIT (old 스냅샷 없음). new=${JSON.stringify(newV).slice(0, 120)}. CAUSE: 미상. RULE: pending.`);
      continue;
    }

    // scalar fields
    for (const f of ['title', 'venue', 'name', 'location', 'startDate', 'endDate'] as const) {
      if (!(f in oldV) && !(f in newV)) continue;
      const a = norm(oldV[f]);
      const b = norm(newV[f]);
      if (a === b) continue;
      lessons.push(`- [${when}] [${tag}] field=${f} WRONG: "${a}" RIGHT: "${b}". CAUSE: ${f} 추출/정규화. RULE: pending.`);
      // venue 이름 치환은 결정적 맵 대상
      if (f === 'venue' && a && b) {
        if (bumpMap(map.venues, canonicalizeVenueText(a).key, b, when)) mapHits++;
      }
    }

    // sessions (date array)
    const oldS = asStrArray(oldV.sessions);
    const newS = asStrArray(newV.sessions);
    if (oldS.join(',') !== newS.join(',')) {
      lessons.push(
        `- [${when}] [${tag}] field=sessions WRONG: [${oldS.join(', ')}] RIGHT: [${newS.join(', ')}]. CAUSE: 날짜 추출. RULE: pending.`,
      );
    }

    // artists (array) — 1:1 치환만 맵 대상
    const oldA = asStrArray(oldV.artists);
    const newA = asStrArray(newV.artists);
    if (oldA.join('|') !== newA.join('|')) {
      const swap = oneToOneSwap(oldA, newA);
      if (swap) {
        lessons.push(
          `- [${when}] [${tag}] field=artist WRONG: "${swap.from}" RIGHT: "${swap.to}". CAUSE: 아티스트명 추출/표기. RULE: correction-map.`,
        );
        if (bumpMap(map.artists, canonicalizeArtistName(swap.from).key, swap.to, when)) mapHits++;
      } else {
        lessons.push(
          `- [${when}] [${tag}] field=artists WRONG: [${oldA.join(', ')}] RIGHT: [${newA.join(', ')}]. CAUSE: 라인업 추출. RULE: pending.`,
        );
      }
    }
  }

  // promotion candidates (count >= threshold)
  const promoted: string[] = [];
  for (const [k, e] of Object.entries(map.artists)) {
    if (e.count >= PROMOTE_THRESHOLD) promoted.push(`artist "${k}" → "${e.to}" (×${e.count})`);
  }
  for (const [k, e] of Object.entries(map.venues)) {
    if (e.count >= PROMOTE_THRESHOLD) promoted.push(`venue "${k}" → "${e.to}" (×${e.count})`);
  }

  console.log(`review-learn: ${lessons.length} lesson(s), ${mapHits} map update(s), ${promoted.length} promotion candidate(s)`);

  if (DRY) {
    console.log('--- (dry-run) lessons ---');
    for (const l of lessons) console.log(l);
    console.log('--- (dry-run) map ---');
    console.log(JSON.stringify(map, null, 2));
    await prisma.$disconnect();
    return;
  }

  // 1) append lessons to CORRECTIONS.md backlog
  appendCorrections(lessons, promoted, ymd(new Date()));

  // 2) persist map
  map.updatedAt = new Date().toISOString();
  if (!existsSync(SKILL_DIR)) mkdirSync(SKILL_DIR, { recursive: true });
  writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n');

  // 3) advance state marker
  writeFileSync(STATE_PATH, JSON.stringify({ lastCreatedAt: maxCreatedAt }, null, 2) + '\n');

  console.log(`review-learn: wrote CORRECTIONS.md (+${lessons.length}), correction-map.json, .learn-state.json`);
  await prisma.$disconnect();
}

function appendCorrections(lessons: Lesson[], promoted: string[], today: string) {
  if (lessons.length === 0 && promoted.length === 0) return;
  if (!existsSync(SKILL_DIR)) mkdirSync(SKILL_DIR, { recursive: true });
  let md = existsSync(CORRECTIONS) ? readFileSync(CORRECTIONS, 'utf-8') : '';
  if (!md) md = '# Ingest skill — corrections log\n\n## Backlog (un-promoted patterns)\n\n## Promoted rules\n';

  const block = [`\n<!-- review-learn ${today} -->`, ...lessons].join('\n') + '\n';

  // backlog 섹션 안, "## Promoted rules" 직전에 삽입. placeholder 줄은 제거.
  const promotedIdx = md.indexOf('## Promoted rules');
  if (promotedIdx !== -1) {
    let head = md.slice(0, promotedIdx);
    const tail = md.slice(promotedIdx);
    head = head.replace(/_\(empty[^\n]*\)_\n?/g, ''); // drop backlog placeholder
    md = head.trimEnd() + '\n' + block + '\n' + tail;
  } else {
    md = md.trimEnd() + '\n' + block;
  }

  if (promoted.length) {
    md = md.replace(/_\(empty[^\n]*\)_\n?/g, ''); // drop promoted placeholder too
    md = md.trimEnd() + '\n' + promoted.map((p) => `- [${today}] PROMOTE: ${p} → correction-map.json 적용 중.`).join('\n') + '\n';
  }

  writeFileSync(CORRECTIONS, md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
