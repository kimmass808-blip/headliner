/**
 * 페스티벌 내부 공연(Show.festivalId != null)은 자기 값이 비면 부모 Festival
 * 값을 **읽기 시점에** 끌어온다(복사 저장하지 않음 — 단일 출처 유지).
 *
 * 설계: docs/festival-show-separation-plan.md (Approach A).
 * 원칙: "child가 비었을 때만, 페스티벌이 출처인 필드만" 상속한다.
 * (날짜·아티스트·스테이지·status는 child 고유이므로 상속하지 않는다)
 */

type VenueShape = { name: string | null; region: string | null } | null;

/** 상속 출처가 되는 부모 페스티벌의 최소 형태. 읽기 경로의 select가 이 모양을 맞춰야 한다. */
export interface ParentFestival {
  name: string;
  posterImageUrl: string | null;
  ticketUrl: string | null;
  ticketOpenAt: Date | null;
  venue: VenueShape;
  locationText: string | null;
}

/** 이미지: show 자기 값 우선, 없으면 페스티벌 포스터. */
export function inheritImage(
  showImageUrl: string | null,
  festival: Pick<ParentFestival, 'posterImageUrl'> | null,
): string | null {
  return showImageUrl ?? festival?.posterImageUrl ?? null;
}

/** 장소: show.venue 우선, 없으면 페스티벌 venue → locationText. */
export function inheritVenue(
  showVenue: VenueShape,
  festival: Pick<ParentFestival, 'venue' | 'locationText'> | null,
): { name: string | null; city: string | null } {
  const name =
    showVenue?.name ?? festival?.venue?.name ?? festival?.locationText ?? null;
  const city = showVenue?.region ?? festival?.venue?.region ?? null;
  return { name, city };
}

/** 티켓: show(또는 session) 티켓 우선, 없으면 페스티벌 통합 티켓. */
export function inheritTicketUrl(
  showTicketUrl: string | null,
  festival: Pick<ParentFestival, 'ticketUrl'> | null,
): string | null {
  return showTicketUrl ?? festival?.ticketUrl ?? null;
}

/** 예매 오픈일: session 값 우선, 없으면 페스티벌 통합 예매 오픈일. */
export function inheritTicketOpenAt(
  sessionTicketOpenAt: Date | null,
  festival: Pick<ParentFestival, 'ticketOpenAt'> | null,
): Date | null {
  return sessionTicketOpenAt ?? festival?.ticketOpenAt ?? null;
}

/**
 * 카드 표시명. 페스티벌 내부 공연은 자기 title이 없으므로
 * 윗줄(primary)=페스티벌명, 밑줄(secondary)=아티스트로 구분한다.
 * 단독공연은 기존대로 title/artist 기준.
 */
export function inheritCardName(
  show: { title: string | null; artists: { canonicalName: string }[] },
  festival: Pick<ParentFestival, 'name'> | null,
): { primary: string; secondary: string | null } {
  const artist = show.artists[0]?.canonicalName ?? null;
  if (festival) {
    return { primary: festival.name, secondary: artist };
  }
  const primary = show.title ?? artist ?? '공연';
  const secondary = show.title && artist ? artist : null;
  return { primary, secondary };
}
