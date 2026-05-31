'use server';

// Admin review-console server actions. Every mutation transitions ReviewStatus
// and/or edits entity data, and appends a ReviewLog row (the learning signal for
// the ingest-show correction loop). Public queries only surface APPROVED rows.

import { revalidatePath, revalidateTag } from 'next/cache';
import { prisma } from '@mft/db';
import { canonicalizeArtistName, canonicalizeVenueText } from '@mft/canonicalize';
import type { Prisma } from '@prisma/client';

const REVIEWER = 'admin';

// Vercel 서버리스 ↔ Supabase 풀러는 쿼리당 왕복 지연이 커서, 기본 5s 인터랙티브
// 트랜잭션 타임아웃을 쉽게 초과한다(P2028). 왕복이 많은 액션(saveShow 등)을 위해
// 넉넉히 상향한다. 단순 액션은 아래처럼 배치 트랜잭션($transaction([...]))으로
// 왕복 자체를 줄여 타임아웃을 회피한다.
const TX_OPTS = { maxWait: 15_000, timeout: 30_000 } as const;

/**
 * 모든 admin 뮤테이션은 공개 데이터(status/내용)를 바꾸므로, admin 콘솔과 함께
 * 공개 페이지 캐시까지 즉시 무효화한다. 덕분에 공개 페이지의 revalidate를 길게(1일)
 * 잡아 캐시 적중률을 높이면서도 수정은 곧바로 반영된다.
 */
function revalidateConsole() {
  // admin 콘솔
  revalidatePath('/admin');
  revalidatePath('/admin/review');
  revalidatePath('/admin/data');
  // 공개: 홈/캘린더의 unstable_cache(데이터 캐시) 태그 무효화
  revalidateTag('shows');
  revalidateTag('festivals');
  // 공개: 상세 페이지 ISR(풀 라우트 캐시) 무효화.
  // 뮤테이션 빈도가 낮아 [id] 전체를 무효화해도 무방(다음 방문 시 재생성).
  revalidatePath('/shows/[id]', 'page');
  revalidatePath('/festivals/[id]', 'page');
  revalidatePath('/artists/[id]', 'page');
}

/** Parse a 'YYYY.MM.DD' (or '-'/'/' separated) string to a UTC midnight Date. */
function parseYmd(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ───────────────────────── Show ─────────────────────────

export async function approveShow(id: string) {
  const before = await prisma.show.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.show.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: null },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Show',
        entityId: id,
        action: 'approve',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'APPROVED' },
        reviewerId: REVIEWER,
      },
    }),
  ]);
  revalidateConsole();
}

export async function rejectShow(id: string, note: string | null) {
  const reason = note?.trim() || null;
  const before = await prisma.show.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.show.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: reason },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Show',
        entityId: id,
        action: 'reject',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'REJECTED' },
        reviewerId: REVIEWER,
        reviewerNote: reason,
      },
    }),
  ]);
  revalidateConsole();
}

/** Hard delete — removes the Show and cascades sessions/setlist. Logs first. */
export async function deleteShow(id: string) {
  const before = await prisma.show.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.reviewLog.create({
      data: {
        entityType: 'Show',
        entityId: id,
        action: 'delete',
        source: 'admin',
        oldValue: { status: before.status, title: before.title },
        reviewerId: REVIEWER,
      },
    }),
    prisma.show.delete({ where: { id } }),
  ]);
  revalidateConsole();
}

export interface ShowEditPayload {
  id: string;
  title: string;
  artists: string[];
  venue: string;
  city: string;
  sessions: { date: string }[];
  festivalId: string | null;
}

/**
 * Full relation edit: resolves artist names (canonicalize → find-or-create →
 * set), venue (find-or-create or disconnect), replaces sessions, relinks the
 * festival, then recomputes completeness/missingFields.
 */
export async function saveShow(payload: ShowEditPayload) {
  await prisma.$transaction(async (tx) => {
    const show = await tx.show.findUnique({
      where: { id: payload.id },
      include: {
        artists: { select: { id: true, canonicalName: true } },
        venue: { select: { name: true } },
        sessions: { orderBy: { date: 'asc' } },
      },
    });
    if (!show) return;

    // Snapshot the pre-edit state in the same shape as newValue, so the
    // review-learn step can diff WRONG(ingest output)→RIGHT(human correction).
    const oldValue = {
      title: show.title ?? null,
      artists: show.artists.map((a) => a.canonicalName),
      venue: show.venue?.name ?? null,
      sessions: show.sessions.map((x) => x.date.toISOString().slice(0, 10)),
      festivalId: show.festivalId,
    } as Prisma.InputJsonValue;

    // 1) Artists — canonicalize + find-or-create, then `set` the relation.
    const artistIds: string[] = [];
    for (const rawName of payload.artists) {
      const name = rawName.trim();
      if (!name) continue;
      const canon = canonicalizeArtistName(name);
      const existing = await tx.artist.findUnique({ where: { canonicalKey: canon.key } });
      if (existing) {
        artistIds.push(existing.id);
      } else {
        const created = await tx.artist.create({
          data: { canonicalName: canon.display, canonicalKey: canon.key, aliases: [] },
        });
        artistIds.push(created.id);
      }
    }

    // 2) Venue — find-or-create by canonical key, or disconnect when cleared.
    let venueId: string | null = null;
    const venueText = payload.venue.trim();
    const region = payload.city.trim() || null;
    if (venueText) {
      const canon = canonicalizeVenueText(venueText);
      const existing = await tx.venue.findUnique({ where: { canonicalKey: canon.key } });
      if (existing) {
        venueId = existing.id;
        if (region && !existing.region) {
          await tx.venue.update({ where: { id: existing.id }, data: { region } });
        }
      } else {
        const created = await tx.venue.create({
          data: { name: canon.display, canonicalKey: canon.key, region },
        });
        venueId = created.id;
      }
    }

    // 3) Sessions — replace the set: delete removed, upsert each provided date.
    const newDates = payload.sessions
      .map((s) => parseYmd(s.date))
      .filter((d): d is Date => d !== null);
    const newKeys = new Set(newDates.map((d) => d.toISOString()));
    for (const existing of show.sessions) {
      if (!newKeys.has(existing.date.toISOString())) {
        await tx.showSession.delete({ where: { id: existing.id } });
      }
    }
    for (const date of newDates) {
      await tx.showSession.upsert({
        where: { showId_date: { showId: payload.id, date } },
        update: {},
        create: { showId: payload.id, date },
      });
    }
    const allSessions = await tx.showSession.findMany({
      where: { showId: payload.id },
      orderBy: { date: 'asc' },
    });

    // 4) Festival relink (validate the id still exists).
    let festivalId: string | null = null;
    if (payload.festivalId) {
      const fest = await tx.festival.findUnique({ where: { id: payload.festivalId }, select: { id: true } });
      festivalId = fest?.id ?? null;
    }

    // 5) Recompute completeness (date · venue · artists≥1).
    const hasDate = allSessions.length > 0;
    const hasVenue = !!venueId;
    const hasArtists = artistIds.length >= 1;
    const completeness = (hasDate ? 1 : 0) + (hasVenue ? 1 : 0) + (hasArtists ? 1 : 0);
    const missingFields: string[] = [];
    if (!hasDate) missingFields.push('date');
    if (!hasVenue) missingFields.push('venue');
    if (!hasArtists) missingFields.push('artists');

    const first = allSessions[0]?.date ?? null;
    const last = allSessions[allSessions.length - 1]?.date ?? null;

    await tx.show.update({
      where: { id: payload.id },
      data: {
        title: payload.title.trim() || null,
        artists: { set: artistIds.map((id) => ({ id })) },
        venueId,
        festivalId,
        sessions: undefined,
        firstSessionDate: first,
        lastSessionDate: last,
        date: first, // legacy mirror
        completeness,
        missingFields,
        needsReview: completeness < 3,
      },
    });

    await tx.reviewLog.create({
      data: {
        entityType: 'Show',
        entityId: payload.id,
        action: 'edit',
        source: 'admin',
        oldValue,
        newValue: {
          title: payload.title.trim() || null,
          artists: payload.artists,
          venue: venueText || null,
          sessions: newDates.map((d) => d.toISOString().slice(0, 10)),
          festivalId,
        } as Prisma.InputJsonValue,
        reviewerId: REVIEWER,
      },
    });
  }, TX_OPTS);
  revalidateConsole();
}

export async function saveShowAndApprove(payload: ShowEditPayload) {
  await saveShow(payload);
  await approveShow(payload.id);
}

// ─────────────────────── Festival ───────────────────────

export async function approveFestival(id: string) {
  const before = await prisma.festival.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.festival.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: null },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Festival',
        entityId: id,
        action: 'approve',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'APPROVED' },
        reviewerId: REVIEWER,
      },
    }),
  ]);
  revalidateConsole();
}

export async function rejectFestival(id: string, note: string | null) {
  const reason = note?.trim() || null;
  const before = await prisma.festival.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.festival.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: reason },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Festival',
        entityId: id,
        action: 'reject',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'REJECTED' },
        reviewerId: REVIEWER,
        reviewerNote: reason,
      },
    }),
  ]);
  revalidateConsole();
}

export async function deleteFestival(id: string) {
  const before = await prisma.festival.findUnique({ where: { id }, select: { status: true, name: true } });
  if (!before) return;
  await prisma.$transaction([
    // Detach linked shows so the FK constraint doesn't block the delete.
    prisma.show.updateMany({ where: { festivalId: id }, data: { festivalId: null } }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Festival',
        entityId: id,
        action: 'delete',
        source: 'admin',
        oldValue: { status: before.status, name: before.name },
        reviewerId: REVIEWER,
      },
    }),
    prisma.festival.delete({ where: { id } }),
  ]);
  revalidateConsole();
}

export interface FestivalEditPayload {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
}

export async function saveFestival(payload: FestivalEditPayload) {
  const fest = await prisma.festival.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      locationText: true,
      _count: { select: { shows: true } },
    },
  });
  if (!fest) return;

  const oldValue = {
    name: fest.name ?? null,
    startDate: fest.startDate ? fest.startDate.toISOString().slice(0, 10) : null,
    endDate: fest.endDate ? fest.endDate.toISOString().slice(0, 10) : null,
    location: fest.locationText ?? null,
  } as Prisma.InputJsonValue;

  const startDate = parseYmd(payload.startDate);
  const endDate = payload.endDate.trim() ? parseYmd(payload.endDate) : null;
  const locationText = payload.location.trim() || null;
  const name = payload.name.trim();

  // completeness (0~2): name · startDate · ≥1 linked show.
  const completeness = (name ? 1 : 0) + (startDate ? 1 : 0) + (fest._count.shows > 0 ? 1 : 0);

  await prisma.$transaction([
    prisma.festival.update({
      where: { id: payload.id },
      data: {
        name: name || undefined,
        startDate,
        endDate,
        locationText,
        completeness,
        needsReview: completeness < 2,
      },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'Festival',
        entityId: payload.id,
        action: 'edit',
        source: 'admin',
        oldValue,
        newValue: {
          name,
          startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
          endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
          location: locationText,
        } as Prisma.InputJsonValue,
        reviewerId: REVIEWER,
      },
    }),
  ]);
  revalidateConsole();
}

export async function saveFestivalAndApprove(payload: FestivalEditPayload) {
  await saveFestival(payload);
  await approveFestival(payload.id);
}

// ─────────────────────── FestivalInfo (관람 정보) ───────────────────────

export async function approveFestivalInfo(id: string) {
  const before = await prisma.festivalInfo.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.festivalInfo.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: null },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'FestivalInfo',
        entityId: id,
        action: 'approve',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'APPROVED' },
        reviewerId: REVIEWER,
      },
    }),
  ]);
  revalidateConsole();
}

export async function rejectFestivalInfo(id: string, note: string | null) {
  const reason = note?.trim() || null;
  const before = await prisma.festivalInfo.findUnique({ where: { id }, select: { status: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.festivalInfo.update({
      where: { id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: REVIEWER, reviewerNote: reason },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'FestivalInfo',
        entityId: id,
        action: 'reject',
        source: 'admin',
        oldValue: { status: before.status },
        newValue: { status: 'REJECTED' },
        reviewerId: REVIEWER,
        reviewerNote: reason,
      },
    }),
  ]);
  revalidateConsole();
}

export async function deleteFestivalInfo(id: string) {
  const before = await prisma.festivalInfo.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.reviewLog.create({
      data: {
        entityType: 'FestivalInfo',
        entityId: id,
        action: 'delete',
        source: 'admin',
        oldValue: { status: before.status, title: before.title },
        reviewerId: REVIEWER,
      },
    }),
    prisma.festivalInfo.delete({ where: { id } }),
  ]);
  revalidateConsole();
}

/** 카테고리 보정 — 이미지 자동분류 오류가 잦아 운영자가 바로잡는 핵심 액션. */
export async function setFestivalInfoCategory(id: string, category: string) {
  const before = await prisma.festivalInfo.findUnique({ where: { id }, select: { category: true } });
  if (!before) return;
  await prisma.$transaction([
    prisma.festivalInfo.update({
      where: { id },
      data: { category: category as Prisma.FestivalInfoUpdateInput['category'] },
    }),
    prisma.reviewLog.create({
      data: {
        entityType: 'FestivalInfo',
        entityId: id,
        action: 'edit',
        source: 'admin',
        field: 'category',
        oldValue: { category: before.category },
        newValue: { category },
        reviewerId: REVIEWER,
      },
    }),
  ]);
  revalidateConsole();
}
