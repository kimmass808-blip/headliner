/**
 * Headliner ingest entrypoint.
 *
 * Reads a JSON payload (stdin or file arg) describing one IG/web visit and
 * the entities it should produce. Upserts Festival/Show/Artist/Venue rows and
 * FestivalInfo(관람 정보: 사이트맵·타임테이블·교통·규정·FAQ·MD/푸드·편의시설 등) rows,
 * uploads images to Supabase Storage, refreshes the search index, and writes
 * an audit log.
 *
 * Contract is defined in .omc/skills/ingest-show/SKILL.md.
 *
 * Usage:
 *   pnpm tsx scripts/ingest.ts < payload.json
 *   pnpm tsx scripts/ingest.ts payload.json
 *   pnpm tsx scripts/ingest.ts --dry-run payload.json
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { canonicalizeArtistName, canonicalizeVenueText } from '@mft/canonicalize';
import { pipeImage } from './lib/posters';

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not set');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

// ---------- correction map (review-learn 산출물) ----------
// /admin/review 에서 누적된 사람 교정을 결정적으로 적용한다. 키는 canonicalize
// key, 값은 교정된 표시명. ingest 가 뽑은 이름이 이 맵에 걸리면 강제 치환한다.
type CorrectionEntry = { to: string; count: number };
const CORRECTION_MAP: { artists: Record<string, CorrectionEntry>; venues: Record<string, CorrectionEntry> } = (() => {
  const p = resolve(process.cwd(), '.omc', 'skills', 'ingest-show', 'correction-map.json');
  if (!existsSync(p)) return { artists: {}, venues: {} };
  try {
    const m = JSON.parse(readFileSync(p, 'utf-8'));
    return { artists: m.artists ?? {}, venues: m.venues ?? {} };
  } catch {
    return { artists: {}, venues: {} };
  }
})();

/** 교정 맵을 적용해 이름을 치환한다(걸리면 corrected display, 아니면 원본). */
function applyArtistCorrection(name: string): string {
  const hit = CORRECTION_MAP.artists[canonicalizeArtistName(name).key];
  return hit?.to ?? name;
}
function applyVenueCorrection(text: string): string {
  const hit = CORRECTION_MAP.venues[canonicalizeVenueText(text).key];
  return hit?.to ?? text;
}

// ---------- payload schema ----------

const ArtistInput = z.object({
  name: z.string().min(1),
  igHandle: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  imageSource: z.string().optional(), // 프로필 사진(로컬경로/URL) → Storage 업로드, Artist.imageUrl이 null일 때만
});

const SessionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ticketUrl: z.string().url().optional(),
  ticketOpenAt: z.string().optional(), // ISO datetime (일반 예매 오픈)
  presaleOpenAt: z.string().optional(), // ISO datetime (선예매/카드사 오픈 — 일반보다 앞섬)
  capacity: z.number().int().optional(),
  notes: z.string().optional(),
});

const ShowEntity = z.object({
  kind: z.literal('show'),
  title: z.string().optional(),
  // v6: one element per calendar performance. Multi-day same-name runs MUST be
  // a single show entity with N sessions (see SKILL.md dedupe rules).
  sessions: z.array(SessionInput).optional(),
  // DEPRECATED legacy top-level fields. Auto-promoted to a single sessions[0]
  // with a (deprecated) warning. Kept so old saved payloads keep loading.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  venueText: z.string().optional(),
  venueRegion: z.string().optional(),
  artists: z.array(ArtistInput).default([]),
  festivalKey: z.string().optional(),
  ticketUrl: z.string().url().optional(),
  imageSource: z.string().optional(),
  stage: z.string().optional(),
  setOrder: z.number().int().optional(),
});

const FestivalEntity = z.object({
  kind: z.literal('festival'),
  name: z.string().min(1),
  year: z.number().int().min(2000).max(2030),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locationText: z.string().optional(),
  officialUrl: z.string().url().optional(),
  ticketUrl: z.string().url().optional(),
  ticketOpenAt: z.string().optional(), // ISO datetime — 페스티벌 통합 예매 오픈
  posterImageSource: z.string().optional(),
  description: z.string().optional(),
  igHandle: z.string().optional(),
});

const FestivalInfoEntity = z.object({
  kind: z.literal('festival_info'),
  festivalKey: z.string(),
  category: z.enum(['MAP', 'TIMETABLE', 'ACCESS', 'RULES', 'FAQ', 'GOODS', 'AMENITY', 'TICKET', 'PROMO', 'NOTICE']),
  title: z.string().optional(),
  sourcePostUrl: z.string().url().optional(),
  imageSources: z.array(z.string()).default([]),
  bodyText: z.string().optional(),
  postedAt: z.string().optional(),
  order: z.number().int().optional(),
});

// 아티스트 계정 크롤 시 "페스티벌 출연"은 새 Show를 만들지 않고, 기존 페스티벌 Show에
// 셋리스트만 enrich 한다(festivalKey + artistName + date 로 매칭). 매칭 실패 시 skip(새로
// 안 만듦). 라인업 원천은 페스티벌 계정이고, 셋리스트는 페스티벌 포스터엔 없는, 아티스트
// 글에서만 얻는 정보다. Setlist/Song 모델은 이미 존재하므로 추가 스키마 없이 채운다.
const SetlistSongInput = z.object({
  title: z.string().min(1),
  isEncore: z.boolean().optional(),
  coverOf: z.string().optional(),
});

const SetlistEntity = z.object({
  kind: z.literal('setlist'),
  festivalKey: z.string().min(1),
  artistName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  songs: z.array(SetlistSongInput).min(1),
  sourceNotes: z.string().optional(),
});

const Entity = z.discriminatedUnion('kind', [ShowEntity, FestivalEntity, FestivalInfoEntity, SetlistEntity]);

const Source = z.object({
  type: z.enum(['ig_post', 'web_page', 'manual']).default('ig_post'),
  accountHandle: z.string().optional(),
  postUrl: z.string().url().optional(),
  shortcode: z.string().optional(),
  capturedAt: z.string().optional(),
});

// 크롤 중 발견한 추가 핸들을 워치리스트(seedAccount)에 등록하기 위한 선택 입력.
// 라인업 아티스트(artists[].igHandle)는 자동 등록되므로, 여기엔 캡션 멘션 등 show에
// 묶이지 않은 핸들이나 festival/venue 핸들만 넣으면 된다.
const SeedInput = z.object({
  handle: z.string().min(1),
  kind: z.enum(['artist', 'festival', 'venue']).optional(), // 기본 'artist'
});

const Payload = z.object({
  source: Source,
  entities: z.array(Entity).default([]),
  notes: z.string().optional(),
  reviewerConfidence: z.enum(['high', 'medium', 'low']).optional(),
  seeds: z.array(SeedInput).optional(),
});

type Payload = z.infer<typeof Payload>;
type ShowInput = z.infer<typeof ShowEntity>;
type FestivalInput = z.infer<typeof FestivalEntity>;
type FestivalInfoInput = z.infer<typeof FestivalInfoEntity>;
type SetlistInput = z.infer<typeof SetlistEntity>;

// ---------- key helpers (shared with dedupe scripts) ----------

const YEAR_PAT = /\b(20\d{2})\b/;

function festivalStrongKey(name: string, year: number): string | null {
  const cleaned = name
    .replace(YEAR_PAT, '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[^\w가-힯]/g, '');
  if (!cleaned) return null;
  return `${cleaned}__${year}`;
}

function originalPostUrl(source: Payload['source'], extra?: string): string {
  // Derive a stable unique key for the Show row. Preference order:
  //   1. caller-provided postUrl
  //   2. www.instagram.com/p/{shortcode}/ if shortcode known
  //   3. fallback to source.accountHandle + extra (anchor)
  if (source.postUrl) {
    return extra ? `${source.postUrl}#${extra}` : source.postUrl;
  }
  if (source.shortcode) {
    const base = `https://www.instagram.com/p/${source.shortcode}/`;
    return extra ? `${base}#${extra}` : base;
  }
  if (source.accountHandle) {
    return `https://www.instagram.com/${source.accountHandle}/#${extra ?? Date.now()}`;
  }
  throw new Error('cannot derive originalPostUrl: source has no postUrl/shortcode/accountHandle');
}

// ---------- upserts ----------

const DRY = process.argv.includes('--dry-run');

type RunStats = {
  festivals: { inserted: number; updated: number };
  shows: { inserted: number; updated: number };
  artists: { found: number; created: number };
  venues: { found: number; created: number };
  festivalInfo: { inserted: number; updated: number };
  setlists: { added: number; skipped: number };
  seeds: { registered: number; skipped: number };
  imagesUploaded: number;
  imageBytesIn: number;
  imageBytesOut: number;
  warnings: string[];
};

async function maybeUploadImage(srcOpt: string | undefined, stats: RunStats): Promise<string | null> {
  if (!srcOpt) return null;
  if (DRY) {
    stats.warnings.push(`(dry-run) would upload image: ${srcOpt}`);
    return null;
  }
  try {
    const { publicUrl, normalized } = await pipeImage(srcOpt);
    stats.imagesUploaded++;
    stats.imageBytesIn += normalized.origBytes;
    stats.imageBytesOut += normalized.buffer.length;
    return publicUrl;
  } catch (e) {
    stats.warnings.push(`image upload failed for ${srcOpt}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// 캐러셀 등 다중 이미지를 순서대로 업로드하고 성공한 publicUrl 배열을 반환.
// 관람 정보(사이트맵·타임테이블)는 밀도가 높아 maxWidth를 크게(2000) 쓴다.
async function maybeUploadImages(
  srcs: string[],
  stats: RunStats,
  opts?: { maxWidth?: number },
): Promise<string[]> {
  if (DRY) {
    for (const s of srcs) if (s) stats.warnings.push(`(dry-run) would upload image: ${s}`);
    return [];
  }
  const urls: string[] = [];
  for (const src of srcs) {
    if (!src) continue;
    try {
      const { publicUrl, normalized } = await pipeImage(src, opts);
      stats.imagesUploaded++;
      stats.imageBytesIn += normalized.origBytes;
      stats.imageBytesOut += normalized.buffer.length;
      urls.push(publicUrl);
    } catch (e) {
      stats.warnings.push(`image upload failed for ${src}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return urls;
}

async function upsertFestival(f: FestivalInput, stats: RunStats): Promise<string | null> {
  const key = festivalStrongKey(f.name, f.year);
  if (!key) {
    stats.warnings.push(`festival "${f.name}" produced empty strong key`);
    return null;
  }
  const posterUrl = await maybeUploadImage(f.posterImageSource, stats);
  const cleanedName = f.name.replace(YEAR_PAT, '').trim().replace(/\s{2,}/g, ' ');
  const displayName = `${f.year} ${cleanedName}`;
  const aliasSet = new Set<string>([cleanedName, f.name, displayName]);

  const data = {
    name: displayName,
    canonicalKey: key,
    aliases: Array.from(aliasSet),
    startDate: f.startDate ? new Date(f.startDate) : undefined,
    endDate: f.endDate ? new Date(f.endDate) : undefined,
    locationText: f.locationText ?? undefined,
    officialUrl: f.officialUrl ?? undefined,
    ticketUrl: f.ticketUrl ?? undefined,
    ticketOpenAt: f.ticketOpenAt ? new Date(f.ticketOpenAt) : undefined,
    posterImageUrl: posterUrl ?? undefined,
    description: f.description ?? undefined,
    igHandle: f.igHandle ? normalizeHandle(f.igHandle) : undefined,
  };

  if (DRY) {
    stats.warnings.push(`(dry-run) would upsert festival ${key}`);
    return null;
  }

  // Festival.igHandle은 @unique이나 한 계정이 여러 해(연도별 festival)를 운영하므로
  // 충돌이 정상이다. 이미 다른 연도 festival이 점유 중이면 이 행엔 igHandle을 비운다.
  if (data.igHandle) {
    const holder = await prisma.festival.findUnique({
      where: { igHandle: data.igHandle },
      select: { canonicalKey: true },
    });
    if (holder && holder.canonicalKey !== key) {
      stats.warnings.push(`festival igHandle "@${data.igHandle}" already held by ${holder.canonicalKey}; skip for ${key}`);
      data.igHandle = undefined;
    }
  }

  const existing = await prisma.festival.findUnique({ where: { canonicalKey: key } });
  if (existing) {
    const mergedAliases = Array.from(new Set([...existing.aliases, ...data.aliases]));
    const patch: any = { aliases: mergedAliases };
    // overwrite only when winner currently null/empty
    if (!existing.startDate && data.startDate) patch.startDate = data.startDate;
    if (!existing.endDate && data.endDate) patch.endDate = data.endDate;
    if (!existing.locationText && data.locationText) patch.locationText = data.locationText;
    if (!existing.officialUrl && data.officialUrl) patch.officialUrl = data.officialUrl;
    if (!existing.ticketUrl && data.ticketUrl) patch.ticketUrl = data.ticketUrl;
    if (!existing.ticketOpenAt && data.ticketOpenAt) patch.ticketOpenAt = data.ticketOpenAt;
    if (!existing.posterImageUrl && data.posterImageUrl) patch.posterImageUrl = data.posterImageUrl;
    if (!existing.description && data.description) patch.description = data.description;
    if (!existing.igHandle && data.igHandle) patch.igHandle = data.igHandle;
    // recompute completeness
    let comp = 0;
    if (patch.startDate || existing.startDate) comp++;
    if (patch.locationText || existing.locationText) comp++;
    patch.completeness = Math.min(comp, 2);
    patch.needsReview = comp < 2;
    await prisma.festival.update({ where: { id: existing.id }, data: patch });
    stats.festivals.updated++;
    return existing.id;
  }
  let comp = 0;
  if (data.startDate) comp++;
  if (data.locationText) comp++;
  const created = await prisma.festival.create({
    data: {
      ...data,
      completeness: Math.min(comp, 2),
      needsReview: comp < 2,
      status: 'APPROVED', // 크롤 import 는 곧바로 게시(수동 검수 없이 공개)
    },
  });
  stats.festivals.inserted++;
  return created.id;
}

async function findOrCreateVenue(rawText: string, stats: RunStats): Promise<string | null> {
  const text = applyVenueCorrection(rawText);
  if (text !== rawText) stats.warnings.push(`venue correction-map: "${rawText}" → "${text}"`);
  const canon = canonicalizeVenueText(text);
  if (!canon.key) return null;
  if (DRY) return null;
  const existing = await prisma.venue.findUnique({ where: { canonicalKey: canon.key } });
  if (existing) {
    stats.venues.found++;
    return existing.id;
  }
  const created = await prisma.venue.create({
    data: { name: canon.display, canonicalKey: canon.key },
  });
  stats.venues.created++;
  return created.id;
}

async function findOrCreateArtist(rawInput: ArtistInput, stats: RunStats): Promise<string | null> {
  const correctedName = applyArtistCorrection(rawInput.name);
  // 교정 시 원래 표기는 alias 로 보존해 다음 매칭에도 도움이 되게 한다.
  const input: ArtistInput =
    correctedName !== rawInput.name
      ? { ...rawInput, name: correctedName, aliases: [...(rawInput.aliases ?? []), rawInput.name] }
      : rawInput;
  if (correctedName !== rawInput.name) stats.warnings.push(`artist correction-map: "${rawInput.name}" → "${correctedName}"`);
  const canon = canonicalizeArtistName(input.name);
  if (!canon.key) return null;
  if (DRY) return null;
  let existing = await prisma.artist.findUnique({ where: { canonicalKey: canon.key } });
  // canonicalKey 미스 + igHandle 보유 시 igHandle로 재조회(표기 불일치로 같은 계정이
  // 다른 이름으로 이미 존재하는 경우). 매칭되면 그 행에 현재 표기를 alias로 병합한다.
  if (!existing && input.igHandle) {
    existing = await prisma.artist.findUnique({ where: { igHandle: normalizeHandle(input.igHandle) } });
    if (existing) stats.warnings.push(`artist igHandle match: "${input.name}" → 기존 "${existing.canonicalName}" (@${normalizeHandle(input.igHandle)})`);
  }
  const incomingAliases = new Set([input.name, ...(input.aliases ?? [])]);
  if (existing) {
    incomingAliases.delete(existing.canonicalName);
    const merged = Array.from(new Set([...existing.aliases, ...incomingAliases]));
    const patch: any = {};
    if (merged.length !== existing.aliases.length) patch.aliases = merged;
    if (!existing.igHandle && input.igHandle) {
      // igHandle은 @unique — 다른 아티스트가 이미 점유 중이면 부여하지 않는다(충돌 방지).
      const h = normalizeHandle(input.igHandle);
      const holder = await prisma.artist.findUnique({ where: { igHandle: h }, select: { id: true } });
      if (!holder) patch.igHandle = h;
      else if (holder.id !== existing.id) stats.warnings.push(`artist igHandle "@${h}" already held; skip for "${existing.canonicalName}"`);
    }
    // 프로필 사진: Artist.imageUrl이 비어 있을 때만 채운다(Spotify enrichment 아트워크 보존).
    if (!existing.imageUrl && input.imageSource) {
      const url = await maybeUploadImage(input.imageSource, stats);
      if (url) patch.imageUrl = url;
    }
    if (Object.keys(patch).length) await prisma.artist.update({ where: { id: existing.id }, data: patch });
    stats.artists.found++;
    return existing.id;
  }
  // Create -- igHandle is unique so suppress collisions
  try {
    const imageUrl = await maybeUploadImage(input.imageSource, stats);
    const created = await prisma.artist.create({
      data: {
        canonicalName: input.name,
        canonicalKey: canon.key,
        aliases: Array.from(incomingAliases).filter((a) => a !== input.name),
        igHandle: input.igHandle ? normalizeHandle(input.igHandle) : undefined,
        imageUrl: imageUrl ?? undefined,
      },
    });
    stats.artists.created++;
    return created.id;
  } catch (e) {
    stats.warnings.push(`artist create failed for "${input.name}": ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

type ArtistInput = z.infer<typeof ArtistInput>;

/**
 * 크롤 중 발견한 IG 핸들을 워치리스트(seedAccount)에 등록한다.
 * - 이미 존재하면(어떤 status든) skip — 운영자의 기존 rejected/dead 결정을 존중.
 * - 크롤 대상 본인 계정(source)은 skip.
 * - 잘못된 핸들 형식은 skip.
 * addedBy='ingest'로 provenance를 남긴다(crawler snowball과 구분).
 */
function normalizeHandle(raw: string): string {
  // 선행 '@'를 모두 제거(복붙·중복으로 '@@'가 들어오는 경우 포함) + 소문자화.
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

async function registerSeed(
  rawHandle: string,
  kind: 'artist' | 'festival' | 'venue',
  sourceHandle: string | null,
  stats: RunStats,
): Promise<void> {
  const handle = normalizeHandle(rawHandle);
  if (!handle || !/^[a-z0-9._]+$/.test(handle)) return; // 해시태그·이메일·빈값 등 skip
  if (sourceHandle && handle === normalizeHandle(sourceHandle)) return; // 자기 자신 skip

  const existing = await prisma.seedAccount.findUnique({
    where: { igHandle: handle },
    select: { igHandle: true },
  });
  if (existing) {
    stats.seeds.skipped++;
    return;
  }
  if (DRY) {
    stats.warnings.push(`(dry-run) would register watchlist seed @${handle} (${kind})`);
    return;
  }
  try {
    await prisma.seedAccount.create({
      data: {
        igHandle: handle,
        kind,
        status: 'pending',
        addedBy: 'ingest',
        sourceSeedHandle: sourceHandle ? normalizeHandle(sourceHandle) : null,
      },
    });
    stats.seeds.registered++;
  } catch {
    // 동시 ingest와의 레이스 등 — 이미 생긴 것으로 간주하고 skip.
    stats.seeds.skipped++;
  }
}

async function upsertShow(
  s: ShowInput,
  source: Payload['source'],
  index: number,
  stats: RunStats,
): Promise<string | null> {
  // Each show needs a unique originalPostUrl. If a single post produces
  // multiple shows, append an anchor disambiguator.
  const anchor = (source.postUrl || source.shortcode)
    ? `${s.artists.map((a) => canonicalizeArtistName(a.name).key).join('-')}-${index}`
    : `entity-${index}`;
  const url = originalPostUrl(source, anchor);

  const venueId = s.venueText ? await findOrCreateVenue(s.venueText, stats) : null;

  const artistIds: string[] = [];
  for (const a of s.artists) {
    const id = await findOrCreateArtist(a, stats);
    if (id) artistIds.push(id);
  }

  let festivalId: string | null = null;
  if (s.festivalKey) {
    const f = await prisma.festival.findUnique({ where: { canonicalKey: s.festivalKey } });
    if (!f) stats.warnings.push(`festivalKey "${s.festivalKey}" not found; show will be unlinked`);
    else festivalId = f.id;
  }

  const imageUrl = await maybeUploadImage(s.imageSource, stats);

  // v6: normalize the show's calendar into a session list. Prefer sessions[];
  // fall back to the deprecated top-level date/startTime/ticketUrl (promoted to
  // a single session, with a warning). Sorted so sessions[0] is the earliest.
  type NormSession = {
    date: string; startTime?: string; endTime?: string;
    ticketUrl?: string; ticketOpenAt?: string; presaleOpenAt?: string; capacity?: number; notes?: string;
  };
  let sessionList: NormSession[];
  if (s.sessions && s.sessions.length > 0) {
    sessionList = s.sessions;
    if (s.date || s.startTime) {
      stats.warnings.push(`show "${s.title ?? url}" has both sessions[] and deprecated top-level date/startTime; ignoring the top-level fields`);
    }
  } else if (s.date) {
    stats.warnings.push(`(deprecated) show "${s.title ?? url}" used top-level date/startTime; promote to sessions[] in new payloads`);
    sessionList = [{ date: s.date, startTime: s.startTime, ticketUrl: s.ticketUrl }];
  } else {
    sessionList = [];
  }
  const sortedSessions = [...sessionList].sort((a, b) => a.date.localeCompare(b.date));
  const firstSession = sortedSessions[0];

  // 페스티벌 내부 공연은 장소를 부모 페스티벌에서 상속(읽기 시점 fallback)하므로,
  // 자기 venue가 없어도 venue 차원을 충족한 것으로 간주한다. 그러지 않으면 라인업
  // 공연이 'venue 누락'으로 completeness가 깎이고 리뷰 큐를 오염시킨다.
  // (참고: docs/festival-show-separation-plan.md / lib/festivalInheritance.ts)
  const hasVenue = !!venueId || !!festivalId;
  const missing: string[] = [];
  if (sortedSessions.length === 0) missing.push('date');
  if (!hasVenue) missing.push('venue');
  if (artistIds.length === 0) missing.push('artists');
  let comp = 0;
  if (sortedSessions.length > 0) comp++;
  if (hasVenue) comp++;
  if (artistIds.length > 0) comp++;

  const data = {
    // DEPRECATED columns kept in sync with the earliest session for back-compat.
    date: firstSession ? new Date(firstSession.date) : null,
    startTime: firstSession?.startTime ?? null,
    venueId,
    title: s.title ?? null,
    originalPostUrl: url,
    imageUrl: imageUrl ?? null,
    ticketUrl: s.ticketUrl ?? null,
    festivalId,
    stage: s.stage ?? null,
    setOrder: s.setOrder ?? null,
    completeness: comp,
    missingFields: missing,
    needsReview: comp < 3,
  };

  if (DRY) {
    stats.warnings.push(`(dry-run) would upsert show ${url}`);
    return null;
  }

  let show;
  const existing = await prisma.show.findUnique({ where: { originalPostUrl: url } });
  if (existing) {
    show = await prisma.show.update({ where: { id: existing.id }, data });
    stats.shows.updated++;
  } else {
    // 크롤 import 는 곧바로 게시(APPROVED)한다. 수동 검수 없이 홈에 노출되도록.
    // (update 경로는 손대지 않아 재크롤 때 수동 반려/검수 결정이 유지된다.)
    show = await prisma.show.create({ data: { ...data, status: 'APPROVED' } });
    stats.shows.inserted++;
  }

  // re-link artists (idempotent INSERT ON CONFLICT)
  // First wipe old links to avoid orphans, then re-insert.
  await prisma.$executeRawUnsafe(`DELETE FROM "_ShowArtists" WHERE "B" = $1`, show.id);
  for (const aid of artistIds) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_ShowArtists" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      aid,
      show.id,
    );
  }

  // v6: the app/search read ShowSession + firstSessionDate/lastSessionDate, not
  // the deprecated Show.date. Upsert every session by (showId, date) so a
  // multi-day show lands as one Show with N sessions. Non-destructive: sessions
  // in the DB but absent from the payload are left alone (operator deletes
  // cancelled sessions manually -- see SKILL.md).
  for (const sess of sortedSessions) {
    const d = new Date(sess.date);
    const sessData = {
      startTime: sess.startTime ?? null,
      endTime: sess.endTime ?? null,
      ticketUrl: sess.ticketUrl ?? null,
      ticketOpenAt: sess.ticketOpenAt ? new Date(sess.ticketOpenAt) : null,
      presaleOpenAt: sess.presaleOpenAt ? new Date(sess.presaleOpenAt) : null,
      capacity: sess.capacity ?? null,
      notes: sess.notes ?? null,
    };
    await prisma.showSession.upsert({
      where: { showId_date: { showId: show.id, date: d } },
      create: { showId: show.id, date: d, ...sessData },
      update: sessData,
    });
  }
  const range = await prisma.showSession.aggregate({
    where: { showId: show.id },
    _min: { date: true },
    _max: { date: true },
  });
  await prisma.show.update({
    where: { id: show.id },
    data: { firstSessionDate: range._min.date, lastSessionDate: range._max.date },
  });
  return show.id;
}

async function upsertFestivalInfo(
  fi: FestivalInfoInput,
  source: Payload['source'],
  stats: RunStats,
): Promise<string | null> {
  // festivalKey로 페스티벌 해석 (show와 동일한 canonicalKey 규칙).
  const festival = await prisma.festival.findUnique({ where: { canonicalKey: fi.festivalKey } });
  if (!festival) {
    stats.warnings.push(`festival_info: festivalKey "${fi.festivalKey}" not found; skipped`);
    return null;
  }
  // sourcePostUrl은 @unique 멱등 키 — 명시값 우선, 없으면 source + #info-<category>로 안정화.
  const sourcePostUrl = fi.sourcePostUrl ?? originalPostUrl(source, `info-${fi.category.toLowerCase()}`);
  // 관람정보 이미지(사이트맵·타임테이블)는 디테일 보존 위해 2000px.
  const imageUrls = await maybeUploadImages(fi.imageSources, stats, { maxWidth: 2000 });

  if (DRY) {
    stats.warnings.push(`(dry-run) would upsert festival_info ${sourcePostUrl}`);
    return null;
  }

  const existing = await prisma.festivalInfo.findUnique({ where: { sourcePostUrl } });
  if (existing) {
    const patch: any = {
      festivalId: festival.id,
      category: fi.category,
      order: fi.order ?? 0,
    };
    if (fi.title !== undefined) patch.title = fi.title;
    if (fi.bodyText !== undefined) patch.bodyText = fi.bodyText;
    if (fi.postedAt) patch.postedAt = new Date(fi.postedAt);
    // 이미지는 새로 업로드된 경우에만 덮어쓴다(DRY/빈 경우 기존 보존).
    if (imageUrls.length) patch.imageUrls = imageUrls;
    await prisma.festivalInfo.update({ where: { id: existing.id }, data: patch });
    stats.festivalInfo.updated++;
    return existing.id;
  }
  const created = await prisma.festivalInfo.create({
    data: {
      festivalId: festival.id,
      category: fi.category,
      title: fi.title ?? null,
      imageUrls,
      bodyText: fi.bodyText ?? null,
      sourcePostUrl,
      postedAt: fi.postedAt ? new Date(fi.postedAt) : null,
      order: fi.order ?? 0,
      status: 'APPROVED', // 크롤 import 는 곧바로 게시(수동 검수 없이 공개)
    },
  });
  stats.festivalInfo.inserted++;
  return created.id;
}

// 아티스트 계정 크롤의 "페스티벌 출연" — 기존 페스티벌 Show를 찾아 셋리스트만 채운다.
// 매칭: festivalKey(canonicalKey) + artistName(canonical) + date(session). 매칭 실패 시
// 새로 만들지 않고 skip. 이미 셋리스트가 있으면 운영자 편집 보호를 위해 덮어쓰지 않고 skip.
async function attachSetlist(e: SetlistInput, stats: RunStats): Promise<void> {
  const festival = await prisma.festival.findUnique({ where: { canonicalKey: e.festivalKey } });
  if (!festival) {
    stats.warnings.push(`setlist: festivalKey "${e.festivalKey}" not found; skipped`);
    stats.setlists.skipped++;
    return;
  }
  const canon = canonicalizeArtistName(e.artistName);
  const artist = canon.key
    ? await prisma.artist.findUnique({ where: { canonicalKey: canon.key } })
    : null;
  if (!artist) {
    stats.warnings.push(`setlist: artist "${e.artistName}" not found; skipped (enrich-only, not created)`);
    stats.setlists.skipped++;
    return;
  }
  const date = new Date(e.date);

  // 같은 페스티벌 + 같은 아티스트 + 같은 날짜 세션을 가진 기존 Show.
  const show = await prisma.show.findFirst({
    where: {
      festivalId: festival.id,
      artists: { some: { id: artist.id } },
      sessions: { some: { date } },
    },
    include: { setlist: { select: { id: true } } },
  });
  if (!show) {
    stats.warnings.push(
      `setlist: no existing show for ${festival.canonicalKey} / ${artist.canonicalName} / ${e.date}; skipped (enrich-only, not created)`,
    );
    stats.setlists.skipped++;
    return;
  }
  // 비파괴: 이미 셋리스트가 있으면 덮어쓰지 않는다(운영자 편집은 /admin/setlists에서).
  if (show.setlist) {
    stats.warnings.push(`setlist: show ${show.id} 이미 셋리스트 보유; skip(덮어쓰지 않음)`);
    stats.setlists.skipped++;
    return;
  }

  if (DRY) {
    stats.warnings.push(`(dry-run) would attach setlist (${e.songs.length} songs) to show ${show.id} (${artist.canonicalName} @ ${e.date})`);
    return;
  }

  await prisma.setlist.create({
    data: {
      showId: show.id,
      sourceNotes: e.sourceNotes ?? null,
      songs: {
        create: e.songs.map((s, i) => ({
          title: s.title,
          order: i,
          isEncore: s.isEncore ?? false,
          coverOf: s.coverOf ?? null,
        })),
      },
    },
  });
  stats.setlists.added++;
}

// ---------- main ----------

async function loadPayload(): Promise<Payload> {
  let raw: string;
  const fileArg = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.json'));
  if (fileArg) {
    raw = readFileSync(fileArg, 'utf-8');
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString('utf-8').trim();
    if (!raw) {
      console.error('No payload on stdin and no file argument. See .omc/skills/ingest-show/SKILL.md');
      process.exit(2);
    }
  }
  const parsed = JSON.parse(raw);
  const result = Payload.safeParse(parsed);
  if (!result.success) {
    console.error('Payload validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(2);
  }
  return result.data;
}

async function main() {
  const payload = await loadPayload();
  console.log(
    `Ingest from ${payload.source.type} ` +
      `(${payload.source.accountHandle ?? payload.source.postUrl ?? 'unknown'}) -- ` +
      `${payload.entities.length} entities  (dry=${DRY})`,
  );

  const stats: RunStats = {
    festivals: { inserted: 0, updated: 0 },
    shows: { inserted: 0, updated: 0 },
    artists: { found: 0, created: 0 },
    venues: { found: 0, created: 0 },
    festivalInfo: { inserted: 0, updated: 0 },
    setlists: { added: 0, skipped: 0 },
    seeds: { registered: 0, skipped: 0 },
    imagesUploaded: 0,
    imageBytesIn: 0,
    imageBytesOut: 0,
    warnings: [],
  };

  // Pass 1: festivals (so shows can reference them by key in same payload)
  for (const e of payload.entities) {
    if (e.kind === 'festival') await upsertFestival(e, stats);
  }

  // Pass 2: shows
  let idx = 0;
  for (const e of payload.entities) {
    if (e.kind === 'show') {
      await upsertShow(e, payload.source, idx, stats);
    }
    idx++;
  }

  // Pass 3: festival_info — festivalKey 해석을 위해 페스티벌 이후에 실행.
  for (const e of payload.entities) {
    if (e.kind === 'festival_info') {
      await upsertFestivalInfo(e, payload.source, stats);
    }
  }

  // Pass 4: setlist — 기존 페스티벌 Show에 셋리스트만 enrich(새로 만들지 않음). 쇼 이후 실행.
  for (const e of payload.entities) {
    if (e.kind === 'setlist') {
      await attachSetlist(e, stats);
    }
  }

  // Pass 5: 워치리스트 seed 등록 — 크롤 중 발견한 아티스트 IG 핸들을 seedAccount에 등록한다.
  // 라인업/단독공연 아티스트(artists[].igHandle)는 자동 수집하고, payload.seeds[]로 명시한
  // 추가 핸들(캡션 멘션·festival/venue 등)도 등록한다. 같은 런 안에서 핸들 단위로 dedupe.
  // (아티스트 데이터 자체의 igHandle/이미지 갱신은 findOrCreateArtist에서 이미 수행됨.)
  const seedMap = new Map<string, 'artist' | 'festival' | 'venue'>();
  for (const e of payload.entities) {
    if (e.kind === 'show') {
      for (const a of e.artists) {
        if (a.igHandle) seedMap.set(normalizeHandle(a.igHandle), 'artist');
      }
    }
  }
  for (const s of payload.seeds ?? []) {
    seedMap.set(normalizeHandle(s.handle), s.kind ?? 'artist');
  }
  const sourceHandle = payload.source.accountHandle ?? null;
  for (const [handle, kind] of seedMap) {
    await registerSeed(handle, kind, sourceHandle, stats);
  }

  // ingest 적재 도장: 이 payload의 출처 계정을 IngestSource에서 'loaded'(적재 완료)로 갱신.
  // (ingest-collect→finalize.mjs가 'collected'로 등록해 둔 행) → /admin/ingest 가 "완료"로 표시.
  // 수집 기록 없이 수동 적재한 경우엔 행이 없으므로 새로 만들어 둔다. 실패는 경고만(적재는 이미 끝남).
  if (!DRY && sourceHandle) {
    const h = normalizeHandle(sourceHandle);
    const showsLoaded = stats.shows.inserted + stats.shows.updated;
    try {
      await prisma.ingestSource.upsert({
        where: { igHandle: h },
        create: { igHandle: h, status: 'loaded', loadedAt: new Date(), showsLoaded },
        update: { status: 'loaded', loadedAt: new Date(), showsLoaded },
      });
    } catch (e) {
      stats.warnings.push(`ingestSource 도장 실패 @${h}: ${(e as Error).message}`);
    }
  }

  // Audit log
  const logDir = resolve(process.cwd(), '.omc', 'ingest-log');
  if (!DRY) mkdirSync(logDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const audit = {
    runAt: new Date().toISOString(),
    dryRun: DRY,
    source: payload.source,
    entitiesCount: payload.entities.length,
    reviewerConfidence: payload.reviewerConfidence ?? null,
    notes: payload.notes ?? null,
    stats,
  };
  if (!DRY) {
    writeFileSync(resolve(logDir, `${ts}.json`), JSON.stringify(audit, null, 2));
  }

  // Refresh search index
  if (!DRY && (stats.festivals.inserted + stats.festivals.updated + stats.shows.inserted + stats.shows.updated) > 0) {
    console.log('Refreshing search_index...');
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY search_index`);
  }

  console.log('');
  console.log(`festivals: ins=${stats.festivals.inserted} upd=${stats.festivals.updated}`);
  console.log(`shows:     ins=${stats.shows.inserted} upd=${stats.shows.updated}`);
  console.log(`artists:   found=${stats.artists.found} created=${stats.artists.created}`);
  console.log(`venues:    found=${stats.venues.found} created=${stats.venues.created}`);
  console.log(`info:      ins=${stats.festivalInfo.inserted} upd=${stats.festivalInfo.updated}`);
  console.log(`setlists:  added=${stats.setlists.added} skip=${stats.setlists.skipped}`);
  console.log(`seeds:     reg=${stats.seeds.registered} skip=${stats.seeds.skipped}`);
  console.log(
    `images:    uploaded=${stats.imagesUploaded}  ` +
      `${(stats.imageBytesIn / 1024).toFixed(0)}KB -> ${(stats.imageBytesOut / 1024).toFixed(0)}KB`,
  );
  if (stats.warnings.length) {
    console.log(`warnings (${stats.warnings.length}):`);
    for (const w of stats.warnings) console.log(`  - ${w}`);
  }
  if (!DRY) console.log(`audit log: .omc/ingest-log/${ts}.json`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
