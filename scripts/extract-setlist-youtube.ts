/**
 * extract-setlist-youtube — 유튜브 공연 풀영상 1개에서 셋리스트를 추출해
 * 기존 stash 포맷(.omc/setlists/<igHandle>.json)으로 적립한다.
 *
 * 배경: 셋리스트 부착의 어려운 부분(아티스트+날짜로 Show 매칭, 비파괴, 멱등)은
 * 이미 scripts/reconcile-setlists.ts 가 처리한다. 이 스크립트는 그 입력인
 * stash 항목을 "유튜브 링크"로부터 만들어 주기만 하면 된다.
 *
 *   [유튜브 링크] → yt-dlp(챕터/설명) → 파싱 → .omc/setlists/<handle>.json
 *                                                      ↓
 *                              기존 reconcile-setlists.ts 가 DB에 부착
 *
 * 1차 출처는 "업로더가 직접 단 타임스탬프(챕터/설명)"다. setlist.fm 같은 외부
 * DB를 긁지 않으므로 약관/저작권 리스크가 낮고, 실제 공연 흐름에 더 정확하다.
 *
 * 곡명 정책: 영상 표기 그대로 텍스트 저장(앞의 "1. " 인덱스만 제거). Track 음원
 * 카탈로그와의 연동은 하지 않는다(별도 작업).
 *
 * 사용:
 *   pnpm extract-setlist-yt --url <링크> --artist <igHandle>
 *   pnpm extract-setlist-yt --url <링크> --artist silicagel.official --dry-run
 *   옵션: --date YYYY-MM-DD  --kind festival|solo|...  --event "이름"  --venue "장소"
 *         --artist-name "표시명"(DB 조회 대신 직접 지정)  --with-comments(타임스탬프 댓글도 출력)
 *
 * 안전: --dry-run 이면 DB도 파일도 건드리지 않고 파싱 결과만 출력한다.
 *       실제 DB 부착은 이 스크립트가 아니라 reconcile-setlists 가 별도로 한다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ---- 인자 파싱 ----------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const URL = arg('url');
const ARTIST = arg('artist'); // igHandle (stash 파일명 + reconcile 매칭 키)
const ARTIST_NAME = arg('artist-name');
const DATE_OVERRIDE = arg('date');
const KIND_OVERRIDE = arg('kind');
const EVENT_OVERRIDE = arg('event');
const VENUE_OVERRIDE = arg('venue');
const DRY = has('dry-run');
const WITH_COMMENTS = has('with-comments');

if (!URL) {
  console.error('사용법: --url <youtube link> --artist <igHandle> [--dry-run] [--date YYYY-MM-DD] [--kind ...] [--event ...]');
  process.exit(1);
}

const STASH_DIR = resolve(process.cwd(), '.omc', 'setlists');

// ---- yt-dlp 메타데이터 ---------------------------------------------------
type YtInfo = {
  title: string;
  description?: string;
  upload_date?: string; // YYYYMMDD
  duration?: number;
  channel?: string;
  chapters?: { start_time: number; end_time: number; title: string }[];
  comments?: { text: string; like_count?: number; author?: string }[];
};

function fetchInfo(url: string): YtInfo {
  const args = ['-J', '--no-warnings'];
  if (WITH_COMMENTS) {
    args.push('--write-comments', '--extractor-args', 'youtube:comment_sort=top;max_comments=120,all,60,5');
  }
  args.push(url);
  const out = execFileSync('yt-dlp', args, { maxBuffer: 256 * 1024 * 1024, encoding: 'utf-8' });
  return JSON.parse(out) as YtInfo;
}

// ---- 챕터/설명 → 곡 목록 -------------------------------------------------
type ParsedSong = { title: string; isEncore: boolean };

// 곡이 아닌 섹션(스킵). 인덱스 접두("1. ") 제거 후 소문자 비교.
const STOP = new Set([
  'intro', 'outro', 'opening', '오프닝', '입장', '등장', '퇴장',
  'ending', 'end', '엔딩', 'ment', '멘트', 'talk', '토크', 'mc',
  '인사', 'interlude', '인터루드', 'soundcheck', 'sound check', '리허설',
]);
// 앙코르 "구간 표시"(이후 곡들을 앙코르로 마킹하고 마커 자체는 스킵)
const ENCORE_MARKER = /^(encore|en|앙코르|앵콜|엥콜|엔코르)$/i;

function stripIndex(s: string): string {
  return s.replace(/^\s*\d{1,3}\s*[.)\-:]\s*/, '').trim();
}

function songsFromChapters(chapters: { title: string }[]): ParsedSong[] {
  const songs: ParsedSong[] = [];
  let encore = false;
  for (const c of chapters) {
    const t = stripIndex(c.title || '');
    const low = t.toLowerCase().trim();
    if (!low) continue;
    if (ENCORE_MARKER.test(low)) { encore = true; continue; }
    if (STOP.has(low)) continue;
    songs.push({ title: t, isEncore: encore });
  }
  return songs;
}

// 챕터가 없을 때: 설명란의 "MM:SS 라벨" 줄을 파싱
function songsFromDescription(desc: string): ParsedSong[] {
  const lines = desc.split('\n');
  const chapters: { title: string }[] = [];
  const re = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+(.+?)\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) chapters.push({ title: m[1] });
  }
  return songsFromChapters(chapters);
}

// ---- 날짜 추정 (제목 우선, 없으면 업로드일) ------------------------------
function inferDate(title: string, uploadDate?: string): { date: string | null; source: string } {
  if (DATE_OVERRIDE) return { date: DATE_OVERRIDE, source: 'override' };
  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  let m = title.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return { date: `${m[1]}-pad2(${m[2]})-pad2(${m[3]})`.replace(/pad2\((\d{1,2})\)/g, (_, d) => String(d).padStart(2, '0')), source: 'title(YYYY.MM.DD)' };
  // 선두 YYMMDD (예: 240803)
  m = title.match(/(?:^|[^\d])(\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (m) {
    const yy = +m[1], mm = +m[2], dd = +m[3];
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return { date: `20${m[1]}-${m[2]}-${m[3]}`, source: 'title(YYMMDD)' };
    }
  }
  // 마지막 수단: 업로드일(공연일과 다를 수 있어 경고)
  if (uploadDate && /^\d{8}$/.test(uploadDate)) {
    return { date: `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`, source: 'upload_date(주의)' };
  }
  return { date: null, source: 'none' };
}

function inferKind(title: string): string {
  if (KIND_OVERRIDE) return KIND_OVERRIDE;
  if (/페스티벌|페스티발|festival|락페|rock\s*festival|fest\b/i.test(title)) return 'festival';
  if (/대학|축제|university/i.test(title)) return 'university';
  if (/방송|broadcast|kbs|sbs|mbc|음악중심|인기가요/i.test(title)) return 'broadcast';
  return 'solo';
}

// 이벤트명: 제목에서 날짜토큰·노이즈 제거한 나머지
function inferEvent(title: string): string {
  if (EVENT_OVERRIDE) return EVENT_OVERRIDE;
  let t = title
    .replace(/(?:^|\s)\d{6}(?:\s|$)/, ' ')            // YYMMDD 토큰
    .replace(/(20\d{2})[.\-/]\d{1,2}[.\-/]\d{1,2}/, '') // YYYY.MM.DD
    .replace(/full\s*live|풀\s*영상|풀\s*라이브|live\s*full/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || title;
}

// ---- 메인 ---------------------------------------------------------------
async function main() {
  console.error(`yt-dlp 메타데이터 수집 중… ${URL}`);
  const info = fetchInfo(URL!);
  const videoId = (URL!.match(/[?&]v=([\w-]{11})/) || URL!.match(/youtu\.be\/([\w-]{11})/) || [])[1] || URL!;

  // 곡 추출: 챕터 우선, 없으면 설명란
  let songs: ParsedSong[] = [];
  let songSource = '';
  if (info.chapters && info.chapters.length) {
    songs = songsFromChapters(info.chapters);
    songSource = `chapters(${info.chapters.length})`;
  } else if (info.description) {
    songs = songsFromDescription(info.description);
    songSource = 'description';
  }

  if (songs.length === 0) {
    console.error('\n✗ 타임스탬프/챕터를 찾지 못했습니다. 이 영상은 자동 추출이 어렵습니다.');
    console.error('  → 설명란이나 댓글의 타임라인을 확인 후 --event/--date 와 함께 수동 보강이 필요할 수 있어요.');
    process.exit(2);
  }

  const { date, source: dateSource } = inferDate(info.title, info.upload_date);
  const kind = inferKind(info.title);
  const eventName = inferEvent(info.title);

  // 아티스트명: 우선 --artist-name, 아니면 DB(igHandle) 조회, 둘 다 없으면 핸들
  let artistName = ARTIST_NAME ?? null;
  if (!artistName && ARTIST && !DRY) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
      const a = await prisma.artist.findUnique({ where: { igHandle: ARTIST }, select: { canonicalName: true } });
      await prisma.$disconnect();
      if (a) artistName = a.canonicalName;
      else console.error(`⚠ DB에 igHandle '${ARTIST}' 아티스트가 없습니다. reconcile 단계에서 매칭이 안 될 수 있어요.`);
    } catch (e) {
      console.error('⚠ 아티스트 DB 조회 실패(무시하고 진행):', (e as Error).message);
    }
  }
  if (!artistName) artistName = ARTIST ?? '(unknown)';

  const entry = {
    artistHandle: ARTIST ?? '',
    artistName,
    date, // YYYY-MM-DD | null
    eventName,
    kind,
    venue: VENUE_OVERRIDE ?? null,
    songs: songs.map((s) => ({ title: s.title, isEncore: s.isEncore })),
    sourcePostUrl: `https://www.youtube.com/watch?v=${videoId}`,
    sourceShortcode: videoId,
    capturedAt: new Date().toISOString(),
    sourceKind: 'youtube',
    applied: false,
  };

  // ---- 출력 ----
  console.error(`\n── 추출 결과 ──────────────────────────────`);
  console.error(`제목     : ${info.title}`);
  console.error(`아티스트 : ${artistName}  (@${ARTIST ?? '미지정'})`);
  console.error(`날짜     : ${date ?? '없음'}  [${dateSource}]`);
  console.error(`이벤트   : ${eventName}  (kind=${kind})`);
  console.error(`곡 출처  : ${songSource}`);
  console.error(`곡 수    : ${songs.length}`);
  songs.forEach((s, i) => console.error(`  ${String(i + 1).padStart(2, ' ')}. ${s.title}${s.isEncore ? '  (encore)' : ''}`));

  if (WITH_COMMENTS && info.comments) {
    const ts = info.comments.filter((c) => /\d{1,2}:\d{2}/.test(c.text)).slice(0, 10);
    if (ts.length) {
      console.error(`\n── 타임스탬프 댓글(잼/커버 수동확인용) ──`);
      ts.forEach((c) => console.error(`  [${c.like_count ?? 0}♥] ${c.text.replace(/\n+/g, ' / ').slice(0, 160)}`));
    }
  }

  if (!ARTIST) {
    console.error(`\n⚠ --artist <igHandle> 가 없어 stash 파일명을 정할 수 없습니다. 미리보기만 출력했어요.`);
    console.error(JSON.stringify(entry, null, 2));
    return;
  }

  if (DRY) {
    console.error(`\n(dry-run) 파일/DB 변경 없음. 저장될 stash 항목 미리보기:`);
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  // ---- stash 적립 (.omc/setlists/<handle>.json, 배열에 append, 중복 URL 스킵) ----
  if (!existsSync(STASH_DIR)) mkdirSync(STASH_DIR, { recursive: true });
  const file = resolve(STASH_DIR, `${ARTIST}.json`);
  let list: any[] = [];
  if (existsSync(file)) {
    try { list = JSON.parse(readFileSync(file, 'utf-8')); } catch { list = []; }
    if (!Array.isArray(list)) list = [];
  }
  const dup = list.find((x) => x.sourcePostUrl === entry.sourcePostUrl);
  if (dup) {
    console.error(`\n= 이미 적립된 영상입니다(스킵): ${entry.sourcePostUrl}`);
    return;
  }
  list.push(entry);
  writeFileSync(file, JSON.stringify(list, null, 2));
  console.error(`\n✓ 적립 완료 → ${file}  (총 ${list.length}건)`);
  console.error(`다음 단계: pnpm reconcile-setlists --only=${ARTIST} --dry-run  으로 부착 미리보기 후, 문제없으면 --dry-run 빼고 실행.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
