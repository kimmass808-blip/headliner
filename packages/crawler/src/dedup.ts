/**
 * Show upsert 로직 (AC-3, AC-3b, AC-5, AC-5b)
 *
 * - originalPostUrl 자연 키로 upsert
 * - completeness 계산 후 Show 생성/갱신
 * - completeness=3 도달 시 fingerprint 계산
 *   - 동일 fingerprint 존재: duplicateOfShowId 마킹 + needsReview=true (hard merge 없음)
 *   - 충돌 없음: fingerprint 저장
 */

import { prisma, Prisma } from '@mft/db';
import { computeShowCompleteness } from '@mft/shared';
import type { ShowExtraction } from '@mft/shared';
import { canonicalizeVenueText, canonicalizeArtistName } from '@mft/canonicalize';
import { computeShowFingerprint } from './fingerprint.js';

export interface UpsertShowInput {
  extraction: ShowExtraction;
  originalPostUrl: string;     // canonicalize 적용 후
  rawTextExcerpt: string;
  festivalId?: string | null;
  stage?: string | null;
  setOrder?: number | null;
}

export interface UpsertShowResult {
  showId: string;
  isNew: boolean;
  completenessJustReached3: boolean;
  duplicateOfShowId?: string;  // unique conflict 시 (AC-5 v5)
}

/**
 * Artist를 canonicalKey로 upsert하고 id를 반환.
 */
async function upsertArtist(name: string): Promise<string> {
  const { key, display } = canonicalizeArtistName(name);
  const artist = await prisma.artist.upsert({
    where: { canonicalKey: key },
    create: {
      canonicalKey: key,
      canonicalName: display,
      aliases: [name],
    },
    update: {},
    select: { id: true },
  });
  return artist.id;
}

/**
 * Venue를 canonicalKey로 upsert하고 id를 반환.
 */
async function upsertVenue(venueText: string): Promise<{ id: string; canonicalKey: string }> {
  const { key, display } = canonicalizeVenueText(venueText);
  const venue = await prisma.venue.upsert({
    where: { canonicalKey: key },
    create: {
      canonicalKey: key,
      name: display,
    },
    update: {},
    select: { id: true, canonicalKey: true },
  });
  return { id: venue.id, canonicalKey: venue.canonicalKey };
}

/**
 * AC-3, AC-3b: completeness 계산 후 Show upsert by originalPostUrl 자연 키.
 * completeness=0이면 Show 미생성 (InstagramPost만 적재 — 호출 측 책임).
 * completeness=3 도달 시 fingerprint 계산:
 *   - 동일 fingerprint Show 존재 시: duplicateOfShowId 마킹 + needsReview=true
 *   - 충돌 없음: fingerprint 저장
 */
export async function upsertShow(input: UpsertShowInput): Promise<UpsertShowResult> {
  const { extraction, originalPostUrl, rawTextExcerpt, festivalId, stage, setOrder } = input;

  const { completeness, missingFields } = computeShowCompleteness(extraction);

  // completeness=0이면 Show 생성 안 함 (호출 측이 InstagramPost만 저장)
  if (completeness === 0) {
    // 이미 존재하는 Show가 있으면 갱신하지 않고 반환
    const existing = await prisma.show.findUnique({
      where: { originalPostUrl },
      select: { id: true, completeness: true },
    });
    if (existing) {
      return { showId: existing.id, isNew: false, completenessJustReached3: false };
    }
    throw new Error('completeness=0: Show 미생성. 호출 측에서 InstagramPost만 저장하세요.');
  }

  // Venue upsert
  let venueId: string | null = null;
  let venueCanonicalKey: string | null = null;
  if (extraction.venueText && extraction.venueText.trim().length > 0) {
    const venue = await upsertVenue(extraction.venueText);
    venueId = venue.id;
    venueCanonicalKey = venue.canonicalKey;
  }

  // Artist upsert
  const artistIds: string[] = [];
  const artistCanonicalKeys: string[] = [];
  for (const name of extraction.artistNames) {
    if (!name.trim()) continue;
    const { key } = canonicalizeArtistName(name);
    const id = await upsertArtist(name);
    artistIds.push(id);
    artistCanonicalKeys.push(key);
  }

  // 기존 Show 조회
  const existingShow = await prisma.show.findUnique({
    where: { originalPostUrl },
    select: { id: true, completeness: true, fingerprint: true },
  });

  const prevCompleteness = existingShow?.completeness ?? -1;

  // completeness=3 도달 시 fingerprint 계산
  let fingerprint: string | null = null;
  let fingerprintInputs: Prisma.InputJsonValue | null = null;
  let duplicateOfShowId: string | undefined;
  const completenessJustReached3 = completeness === 3 && prevCompleteness < 3;

  if (completeness === 3 && extraction.date && venueCanonicalKey) {
    const inputs = {
      dateIso: extraction.date,
      venueCanonicalKey,
      artistCanonicalKeys,
    };
    fingerprint = computeShowFingerprint(inputs);
    fingerprintInputs = inputs;

    // fingerprint 충돌 확인 (AC-5 v5)
    const existingByFp = await prisma.show.findUnique({
      where: { fingerprint },
      select: { id: true },
    });
    if (existingByFp && existingByFp.id !== existingShow?.id) {
      duplicateOfShowId = existingByFp.id;
      // 충돌 시 fingerprint 저장 안 함 (duplicateOfShowId로만 마킹)
      fingerprint = null;
      fingerprintInputs = null;
    }
  }

  // transactional upsert
  const result = await prisma.$transaction(async (tx) => {
    let show: { id: string };

    if (existingShow) {
      // 갱신
      show = await tx.show.update({
        where: { id: existingShow.id },
        data: {
          date: extraction.date ? new Date(extraction.date) : null,
          startTime: extraction.startTime ?? null,
          venueId,
          title: extraction.title ?? null,
          ticketUrl: extraction.ticketUrl ?? null,
          imageUrl: extraction.imageUrl ?? null,
          rawTextExcerpt,
          festivalId: festivalId ?? null,
          stage: stage ?? null,
          setOrder: setOrder ?? null,
          completeness,
          missingFields,
          needsReview: completeness < 3,
          fingerprint,
          fingerprintInputs: fingerprintInputs ?? Prisma.JsonNull,
          duplicateOfShowId: duplicateOfShowId ?? null,
          artists: {
            set: artistIds.map((id) => ({ id })),
          },
        },
        select: { id: true },
      });
    } else {
      // 신규 생성
      show = await tx.show.create({
        data: {
          originalPostUrl,
          date: extraction.date ? new Date(extraction.date) : null,
          startTime: extraction.startTime ?? null,
          venueId,
          title: extraction.title ?? null,
          ticketUrl: extraction.ticketUrl ?? null,
          imageUrl: extraction.imageUrl ?? null,
          rawTextExcerpt,
          festivalId: festivalId ?? null,
          stage: stage ?? null,
          setOrder: setOrder ?? null,
          completeness,
          missingFields,
          needsReview: completeness < 3,
          fingerprint,
          fingerprintInputs: fingerprintInputs ?? Prisma.JsonNull,
          duplicateOfShowId: duplicateOfShowId ?? null,
          artists: {
            connect: artistIds.map((id) => ({ id })),
          },
        },
        select: { id: true },
      });
    }

    return show;
  });

  return {
    showId: result.id,
    isNew: !existingShow,
    completenessJustReached3,
    duplicateOfShowId,
  };
}
