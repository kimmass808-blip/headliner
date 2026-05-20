/**
 * Pentaport 2026 라인업 부트스트랩 적재.
 * @mft/crawler 의 정식 흐름이 IG fetch에서 막혀서, Claude in Chrome으로 추출한
 * 데이터를 직접 Prisma로 insert. 일회성 부트스트랩 — 정규 운영은 Phase 1.7 후 진행.
 *
 * 실행:
 *   set -a && source .env && set +a && pnpm tsx scripts/seed-pentaport.ts
 */

import { PrismaClient } from '@prisma/client';

// pgbouncer 풀러는 implicit M2M의 FK 가시성 이슈가 있음 (생성→ 다른 connection이 못 봄).
// 부트스트랩은 DIRECT_URL로 비풀러 연결.
const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL 환경 변수가 설정되지 않았습니다');
  process.exit(1);
}
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
  log: ['query', 'error', 'warn'],
});
import {
  canonicalizeVenueText,
  canonicalizeArtistName,
  canonicalizeInstagramUrl,
  canonicalizeInstagramHandle,
} from '@mft/canonicalize';
import { computeShowFingerprint } from '@mft/crawler';

const FESTIVAL_POST_URL = 'https://www.instagram.com/pentaportrf/p/DYTZ5RFmTD5/';
const FESTIVAL_HANDLE = 'pentaportrf';

const FESTIVAL_DATA = {
  name: '2026 인천펜타포트 락 페스티벌',
  aliases: [
    'Incheon Pentaport Rock Festival 2026',
    '펜타포트 2026',
    'Pentaport 2026',
    '인천펜타포트',
  ],
  startDate: new Date('2026-07-31'),
  endDate: new Date('2026-08-02'),
  locationText: '송도 문라이트 페스티벌 파크, 인천',
  igHandle: FESTIVAL_HANDLE,
  description:
    'REBOOT. THE PORT OPENS. 인천펜타포트 락 페스티벌 2026. ' +
    '3일권 240,000원 / 1일권 120,000원. 티켓 오픈 2026-05-21 14:00. ' +
    '예매처: NOL 티켓, KB Pay, YES24, 엔티켓, NOL WORLD, MODERN SKY, Trip.com.',
};

const VENUE_DATA = {
  name: '송도 문라이트 페스티벌 파크',
  address: '인천 연수구 송도',
  region: '인천',
};

interface ArtistInput {
  ko: string;
  en?: string | null;
  igHandle?: string | null;
}

// 헤드라이너 (day 미정, festival.startDate로 default)
const HEADLINERS: ArtistInput[] = [
  { ko: '매시브 어택', en: 'MASSIVE ATTACK', igHandle: 'massiveattackofficial' },
  { ko: '픽시즈', en: 'PIXIES', igHandle: 'pixiesofficial' },
  { ko: '혁오', en: 'HYUKOH', igHandle: 'hyukohofficial' },
  { ko: '술탄오브더디스코', en: 'Sultan Of The Disco', igHandle: 'sultan_of_the_disco' },
  { ko: '나상현씨밴드', en: 'Band Nah', igHandle: 'band_nah' },
  { ko: '심아일랜드', en: 'SIMILE LAND', igHandle: 'simile_land' },
  { ko: '다브다', en: 'Dabda', igHandle: 'banddabda' },
  { ko: '이날치', en: 'LEENALCHI', igHandle: 'leenalchi' },
];

const DAY1: ArtistInput[] = [
  { ko: '크루앙빈', en: 'KHRUANGBIN', igHandle: 'khruangbin' },
  { ko: '더 발룬티어스', en: 'The Volunteers', igHandle: 'the_volunteers.com_' },
  { ko: '쏜애플', en: 'THORNAPPLE', igHandle: 'thornapple_official' },
  { ko: '레몬 트윅스', en: 'The Lemon Twigs', igHandle: 'thelemontwigs' },
  { ko: '더 폴스', en: 'The Poles', igHandle: 'thepoles_official' },
  { ko: '모노 노 아와레', en: 'MONO NO AWARE', igHandle: 'mono.no.aware.0630' },
  { ko: '브로큰 발렌타인', en: 'Broken Valentine', igHandle: 'brokenvalentine_official' },
  { ko: '신인류', en: 'SHIN IN RYU', igHandle: 'shin_in_ryu' },
  { ko: '윤마치', en: 'MRCH', igHandle: 'yooonmarch' },
  { ko: '키라라', en: 'KIRARA', igHandle: 'stqpkiraradongjae' },
];

const DAY2: ArtistInput[] = [
  { ko: '장필순', en: 'Jang Pill Soon', igHandle: 'jejusoony' },
  { ko: '권진아', en: 'KWON JIN AH', igHandle: 'kwonjinah_official' },
  { ko: '극동아시아타이거즈', en: 'Far East Asian Tigers', igHandle: 'far_east_asian_tigers' },
  { ko: '더 긱스', en: 'the geeks', igHandle: 'thegeekshc' },
  { ko: '네버 영 비치', en: 'never young beach', igHandle: 'never_young_beach_official' },
  { ko: '반', en: 'baan', igHandle: 'baanjae' },
  { ko: '세이수미', en: 'Say Sue Me', igHandle: 'saysueme' },
  { ko: '이샤나 사라스바티', en: 'Isyana Sarasvati', igHandle: 'isyanasarasvati' },
  { ko: '잭킹콩', en: 'JKC', igHandle: 'jackingcong' },
  { ko: '초록불꽃소년단', en: 'Green Flame Boys', igHandle: 'greenflameboys_official' },
  { ko: '할로우 잰', en: 'Hollow Jan', igHandle: 'hollowjan' },
];

const DAY3: ArtistInput[] = [
  { ko: '실리카겔', en: 'Silica Gel', igHandle: 'silicagel.official' },
  { ko: '드래곤포니', en: 'Dragon Pony', igHandle: 'dragonpony_' },
  { ko: '리도어', en: 'Redoor', igHandle: 'band_redoor' },
  { ko: '백현진', en: 'Bek Hyunjin', igHandle: 'bekhyunjin_official' },
  { ko: '봉제인간', en: 'Bongjeingan', igHandle: 'bongjeingan' },
  { ko: '컨파인드 화이트', en: 'Confined White', igHandle: 'confinedwhite_official' },
  { ko: '팻햄스터 & 캉뉴', en: 'Fat Hamster & KANG New', igHandle: 'fathamsterandkangnew' },
];

async function upsertArtist(input: ArtistInput) {
  const canonical = canonicalizeArtistName(input.ko);
  const aliases = [input.en].filter((s): s is string => !!s);
  const cleanHandle = input.igHandle ? canonicalizeInstagramHandle(input.igHandle) : null;
  return prisma.artist.upsert({
    where: { canonicalKey: canonical.key },
    update: {
      aliases,
      ...(cleanHandle ? { igHandle: cleanHandle } : {}),
    },
    create: {
      canonicalName: canonical.display,
      canonicalKey: canonical.key,
      aliases,
      igHandle: cleanHandle,
    },
  });
}

async function upsertVenue() {
  const canonical = canonicalizeVenueText(VENUE_DATA.name);
  return prisma.venue.upsert({
    where: { canonicalKey: canonical.key },
    update: {
      name: VENUE_DATA.name,
      address: VENUE_DATA.address,
      region: VENUE_DATA.region,
    },
    create: {
      name: VENUE_DATA.name,
      canonicalKey: canonical.key,
      address: VENUE_DATA.address,
      region: VENUE_DATA.region,
    },
  });
}

async function upsertFestival(venueId: string) {
  const canonical = canonicalizeVenueText(FESTIVAL_DATA.name);
  const cleanHandle = canonicalizeInstagramHandle(FESTIVAL_DATA.igHandle);
  return prisma.festival.upsert({
    where: { canonicalKey: canonical.key },
    update: {
      name: FESTIVAL_DATA.name,
      aliases: FESTIVAL_DATA.aliases,
      startDate: FESTIVAL_DATA.startDate,
      endDate: FESTIVAL_DATA.endDate,
      venueId,
      locationText: FESTIVAL_DATA.locationText,
      igHandle: cleanHandle,
      description: FESTIVAL_DATA.description,
      completeness: 2, // name + startDate 둘 다 채워짐
      needsReview: false,
    },
    create: {
      name: FESTIVAL_DATA.name,
      canonicalKey: canonical.key,
      aliases: FESTIVAL_DATA.aliases,
      startDate: FESTIVAL_DATA.startDate,
      endDate: FESTIVAL_DATA.endDate,
      venueId,
      locationText: FESTIVAL_DATA.locationText,
      igHandle: cleanHandle,
      description: FESTIVAL_DATA.description,
      completeness: 2,
      needsReview: false,
    },
  });
}

async function upsertShow(opts: {
  artistId: string;
  artistCanonicalKey: string;
  festivalId: string;
  venueId: string;
  venueCanonicalKey: string;
  date: Date | null; // null = day 미정 (헤드라이너)
  originalPostUrl: string;
  rawTextExcerpt: string;
}) {
  // 자연 키 = originalPostUrl + artist (한 게시물에서 N artist 만들 때 구분)
  // Headliner 같은 partial Show는 페스티벌 게시물 1개에서 다수 생성 →
  //   originalPostUrl이 같으면 unique 충돌. 그래서 artist별 unique key 분리.
  const distinguishedUrl = `${opts.originalPostUrl}#${opts.artistCanonicalKey}`;

  // 완전 추출인 경우 fingerprint 계산 (date·venue·artist 모두 있을 때)
  const hasDate = opts.date !== null;
  const hasVenue = true; // venue는 Festival에서 상속
  const hasArtist = true;
  const completeness = (hasDate ? 1 : 0) + (hasVenue ? 1 : 0) + (hasArtist ? 1 : 0);
  const missingFields: string[] = [];
  if (!hasDate) missingFields.push('date');

  let fingerprint: string | null = null;
  let fingerprintInputs: any = null;
  if (completeness === 3 && opts.date) {
    fingerprint = computeShowFingerprint({
      dateIso: opts.date.toISOString().slice(0, 10),
      venueCanonicalKey: opts.venueCanonicalKey,
      artistCanonicalKeys: [opts.artistCanonicalKey],
    });
    fingerprintInputs = {
      dateKey: opts.date.toISOString().slice(0, 10),
      venueCanonicalKey: opts.venueCanonicalKey,
      artistCanonicalKeys: [opts.artistCanonicalKey],
    };
  }

  // 2단계: 먼저 Show를 artists 없이 upsert, 그 다음 별도로 artists 연결.
  // implicit M2M + upsert 조합이 Prisma 5.22 + pgbouncer에서 FK 순서 이슈가 있어 분리.
  const existing = await prisma.show.findUnique({
    where: { originalPostUrl: distinguishedUrl },
    select: { id: true },
  });
  let showId: string;
  if (existing) {
    await prisma.show.update({
      where: { id: existing.id },
      data: {
        date: opts.date,
        venueId: opts.venueId,
        festivalId: opts.festivalId,
        completeness,
        missingFields,
        needsReview: completeness < 3,
        fingerprint,
        fingerprintInputs,
      },
    });
    showId = existing.id;
  } else {
    const created = await prisma.show.create({
      data: {
        originalPostUrl: distinguishedUrl,
        date: opts.date,
        venueId: opts.venueId,
        festivalId: opts.festivalId,
        rawTextExcerpt: opts.rawTextExcerpt,
        completeness,
        missingFields,
        needsReview: completeness < 3,
        fingerprint,
        fingerprintInputs,
      },
      select: { id: true },
    });
    showId = created.id;
  }
  // Artists 연결 — 직접 raw SQL로 _ShowArtists 삽입.
  // Prisma 규약: implicit M2M 조인 테이블의 컬럼 A/B는 모델명 알파벳 순.
  // Artist < Show 이므로 A = Artist.id, B = Show.id. (migration 20260520120000 참고)
  await prisma.$executeRaw`
    INSERT INTO "_ShowArtists" ("A", "B")
    VALUES (${opts.artistId}, ${showId})
    ON CONFLICT ("A", "B") DO NOTHING
  `;
  return { id: showId, completeness };
}

async function upsertSeed(handle: string, sourceSeed: string) {
  const clean = canonicalizeInstagramHandle(handle);
  if (!clean) return null;
  return prisma.seedAccount.upsert({
    where: { igHandle: clean },
    update: {},
    create: {
      igHandle: clean,
      kind: 'artist',
      status: 'pending',
      addedBy: 'snowball',
      sourceSeedHandle: sourceSeed,
    },
  });
}

async function main() {
  console.log('=== Pentaport 2026 부트스트랩 적재 ===');

  // 1. Venue
  const venue = await upsertVenue();
  console.log(`Venue upserted: ${venue.name} (${venue.id})`);

  // 2. Festival
  const festival = await upsertFestival(venue.id);
  console.log(`Festival upserted: ${festival.name} (${festival.id})`);

  // 3. Operator seed for the festival itself
  await prisma.seedAccount.upsert({
    where: { igHandle: 'pentaportrf' },
    update: { status: 'active' },
    create: {
      igHandle: 'pentaportrf',
      kind: 'festival',
      status: 'active',
      addedBy: 'operator',
    },
  });
  console.log('Seed pentaportrf marked as operator/active');

  const venueCanonical = canonicalizeVenueText(VENUE_DATA.name);

  // 4. Artists + Shows
  type Section = { artists: ArtistInput[]; date: Date | null; label: string };
  const sections: Section[] = [
    { artists: HEADLINERS, date: null, label: 'Headliners (day TBD)' },
    { artists: DAY1, date: new Date('2026-07-31'), label: 'Day 1 (Fri)' },
    { artists: DAY2, date: new Date('2026-08-01'), label: 'Day 2 (Sat)' },
    { artists: DAY3, date: new Date('2026-08-02'), label: 'Day 3 (Sun)' },
  ];

  let totalShows = 0;
  let totalSeeds = 0;

  for (const section of sections) {
    console.log(`\n--- ${section.label} (${section.artists.length} artists) ---`);
    for (const input of section.artists) {
      const artist = await upsertArtist(input);
      const canonical = canonicalizeArtistName(input.ko);
      const show = await upsertShow({
        artistId: artist.id,
        artistCanonicalKey: canonical.key,
        festivalId: festival.id,
        venueId: venue.id,
        venueCanonicalKey: venueCanonical.key,
        date: section.date,
        originalPostUrl: FESTIVAL_POST_URL,
        rawTextExcerpt: `${input.ko}${input.en ? ` (${input.en})` : ''} — ${section.label}`,
      });
      totalShows++;

      // Snowball seed
      if (input.igHandle) {
        const seed = await upsertSeed(input.igHandle, FESTIVAL_HANDLE);
        if (seed) totalSeeds++;
      }

      console.log(
        `  • ${input.ko}${input.en ? ` (${input.en})` : ''}` +
          ` → Show ${show.id.slice(0, 8)} (completeness=${show.completeness})`
      );
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`Festival: 1`);
  console.log(`Venues: 1`);
  console.log(`Artists: ${HEADLINERS.length + DAY1.length + DAY2.length + DAY3.length}`);
  console.log(`Shows: ${totalShows}`);
  console.log(`Snowball seeds (pending): ${totalSeeds}`);

  // 5. InstagramPost 적재 (출처 추적용)
  await prisma.instagramPost.upsert({
    where: { canonicalUrl: canonicalizeInstagramUrl(FESTIVAL_POST_URL) },
    update: {},
    create: {
      canonicalUrl: canonicalizeInstagramUrl(FESTIVAL_POST_URL),
      sourceAccount: FESTIVAL_HANDLE,
      postedAt: new Date('2026-05-14'), // 6일 전 (오늘 기준 추정)
      rawText: '2차 라인업 공개 게시물 (Claude in Chrome으로 추출)',
      imageUrls: [],
      postType: 'festival_lineup',
      extractedFestivalId: festival.id,
    },
  });
  console.log('InstagramPost row inserted');

  // 6. search_index MV refresh (즉시 검색 가능하도록)
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW search_index');
  console.log('search_index refreshed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
