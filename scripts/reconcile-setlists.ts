/**
 * reconcile-setlists — 셋리스트 stash를 기존 Show에 비파괴적으로 부착한다.
 *
 * 배경: 셋리스트는 **아티스트 IG 계정**에서 발견되지만, 매칭될 Show는 보통
 * **페스티벌 계정 크롤**(또는 아티스트 단독공연 적재)에서 나중에 생긴다. 두 시점이
 * 어긋나 인라인 매칭(scripts/ingest.ts의 attachSetlist)으로는 자주 버려진다.
 * 그래서 크롤 중 발견한 셋리스트를 `.omc/setlists/<igHandle>.json`에 **적립(stash)**
 * 해두고, 이 스크립트가 아무 때나 돌면서 **아티스트 + 세션 날짜**로 Show를 찾아
 * 셋리스트를 붙인다. 매칭 Show가 아직 없으면 그대로 두고 다음 실행에서 재시도한다.
 *
 * ingest의 attachSetlist 대비 개선점:
 *   - festivalKey를 **요구하지 않는다** → 페스티벌 공연뿐 아니라 **단독공연**에도 부착.
 *   - 발견-적립과 부착을 분리 → 크롤 순서와 무관하게 소실 없이 수렴.
 *
 * 비파괴: Show에 이미 셋리스트가 있으면 덮어쓰지 않는다(운영자 편집은 /admin/setlists).
 *
 * stash 항목 형식(.omc/setlists/<handle>.json = 항목 배열):
 *   {
 *     artistHandle, artistName,
 *     date,            // 이벤트 날짜 'YYYY-MM-DD' (best-effort, null 가능 → skip)
 *     eventName, kind, // kind: festival|solo|university|overseas|broadcast|event
 *     venue,           // optional
 *     songs: [{ title, isEncore, coverOf? }],
 *     sourcePostUrl, sourceShortcode, capturedAt,
 *     applied,         // 부착/확인 완료 시 true (재실행 시 skip)
 *     appliedShowId?, appliedAt?, status?   // 결과 기록
 *   }
 *
 * 사용:
 *   pnpm reconcile-setlists                 # 전체 stash 정합
 *   pnpm reconcile-setlists --dry-run       # DB 변경 없이 매칭 결과만
 *   pnpm reconcile-setlists --only=dragonpony_   # 특정 핸들만
 *   pnpm reconcile-setlists --kinds=festival,solo  # 특정 kind만(기본: 전부)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { canonicalizeArtistName } from '@mft/canonicalize';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const DRY = process.argv.includes('--dry-run');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null;
const kindsArg = process.argv.find((a) => a.startsWith('--kinds='));
const KINDS = kindsArg ? new Set(kindsArg.slice('--kinds='.length).split(',').map((s) => s.trim())) : null;

const STASH_DIR = resolve(process.cwd(), '.omc', 'setlists');

type Song = { title: string; isEncore?: boolean; coverOf?: string };
type StashEntry = {
  artistHandle: string;
  artistName: string;
  date: string | null;
  eventName: string;
  kind: string;
  venue?: string | null;
  songs: Song[];
  sourcePostUrl?: string;
  sourceShortcode?: string;
  capturedAt?: string;
  applied?: boolean;
  appliedShowId?: string;
  appliedAt?: string;
  status?: string;
};

const stats = {
  files: 0,
  entries: 0,
  attached: 0,
  alreadyApplied: 0,
  skippedKind: 0,
  noDate: 0,
  noArtist: 0,
  noShow: 0,
  showHasSetlist: 0,
};
const log: string[] = [];

function loadStashFiles(): { path: string; handle: string; entries: StashEntry[] }[] {
  if (!existsSync(STASH_DIR)) return [];
  return readdirSync(STASH_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const handle = f.replace(/\.json$/, '');
      const path = resolve(STASH_DIR, f);
      const entries = JSON.parse(readFileSync(path, 'utf-8')) as StashEntry[];
      return { path, handle, entries };
    })
    .filter((s) => !ONLY || s.handle === ONLY);
}

async function reconcileEntry(e: StashEntry): Promise<boolean> {
  // 이미 처리됨
  if (e.applied) {
    stats.alreadyApplied++;
    return false;
  }
  // kind 필터
  if (KINDS && !KINDS.has(e.kind)) {
    stats.skippedKind++;
    return false;
  }
  // 날짜 없는 항목은 안전하게 매칭 불가 → 보류(다음에 날짜 보강되면 재시도)
  if (!e.date) {
    stats.noDate++;
    log.push(`· 보류(날짜없음): ${e.artistName} / ${e.eventName}`);
    return false;
  }

  const canon = canonicalizeArtistName(e.artistName);
  // igHandle 우선, 실패 시 canonicalKey
  const artist =
    (await prisma.artist.findUnique({ where: { igHandle: e.artistHandle } })) ??
    (canon.key ? await prisma.artist.findUnique({ where: { canonicalKey: canon.key } }) : null);
  if (!artist) {
    stats.noArtist++;
    log.push(`· 아티스트 없음: @${e.artistHandle} (${e.artistName})`);
    return false;
  }

  const date = new Date(e.date);
  // festivalKey 요구 없음 — 아티스트 + 세션 날짜로 Show 검색(단독공연 포함)
  const shows = await prisma.show.findMany({
    where: {
      artists: { some: { id: artist.id } },
      sessions: { some: { date } },
    },
    include: { setlist: { select: { id: true } }, festival: { select: { name: true } } },
  });

  if (shows.length === 0) {
    stats.noShow++;
    log.push(`· 매칭 Show 없음(보류): ${e.artistName} / ${e.eventName} / ${e.date}`);
    return false;
  }
  if (shows.length > 1) {
    log.push(`⚠ 같은 날 Show ${shows.length}개 — 첫 번째 사용: ${e.artistName} / ${e.date}`);
  }
  const show = shows[0];

  // 비파괴
  if (show.setlist) {
    stats.showHasSetlist++;
    e.applied = true;
    e.appliedShowId = show.id;
    e.status = 'skipped-existing';
    log.push(`= 이미 셋리스트 보유(보호): ${e.artistName} / ${e.eventName} → show ${show.id}`);
    return true; // stash 갱신(재시도 방지)
  }

  if (DRY) {
    log.push(`(dry-run) 부착 예정: ${e.songs.length}곡 → ${e.artistName} / ${e.eventName} / ${e.date} (show ${show.id}${show.festival ? `, ${show.festival.name}` : ', 단독'})`);
    return false;
  }

  await prisma.setlist.create({
    data: {
      showId: show.id,
      sourceNotes: `${e.eventName}${e.sourcePostUrl ? ` — ${e.sourcePostUrl}` : ''}`,
      songs: {
        create: e.songs.map((s, i) => ({
          title: s.title,
          order: i + 1,
          isEncore: !!s.isEncore,
          coverOf: s.coverOf ?? null,
        })),
      },
    },
  });
  stats.attached++;
  e.applied = true;
  e.appliedShowId = show.id;
  e.appliedAt = new Date().toISOString();
  e.status = 'attached';
  log.push(`✓ 부착: ${e.songs.length}곡 → ${e.artistName} / ${e.eventName} / ${e.date} (show ${show.id}${show.festival ? `, ${show.festival.name}` : ', 단독'})`);
  return true;
}

async function main() {
  const files = loadStashFiles();
  stats.files = files.length;
  for (const file of files) {
    let dirty = false;
    for (const e of file.entries) {
      stats.entries++;
      const changed = await reconcileEntry(e);
      if (changed && !DRY) dirty = true;
    }
    if (dirty) writeFileSync(file.path, JSON.stringify(file.entries, null, 2));
  }

  console.log(`\nreconcile-setlists ${DRY ? '(dry-run) ' : ''}— ${stats.files} files, ${stats.entries} entries`);
  for (const line of log) console.log('  ' + line);
  console.log('\n요약:');
  console.log(`  부착(attached):        ${stats.attached}`);
  console.log(`  이미 보유(보호):        ${stats.showHasSetlist}`);
  console.log(`  Show 없음(보류):        ${stats.noShow}`);
  console.log(`  날짜 없음(보류):        ${stats.noDate}`);
  console.log(`  아티스트 없음:          ${stats.noArtist}`);
  console.log(`  kind 제외:             ${stats.skippedKind}`);
  console.log(`  이미 처리됨(skip):      ${stats.alreadyApplied}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
