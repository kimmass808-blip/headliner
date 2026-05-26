/**
 * ShowCard — 검색 결과 그리드용 thin adapter.
 *
 * 다크 통합 후, 시각 사양은 `components/home/PosterCard`에 단일화.
 * 이 파일은 search-results 측 데이터 모양(`Show` with venue/artists/festival)을
 * `HomePosterCardProps`로 매핑만 담당.
 */

import { PosterCard, formatWeekdayShort } from './home/PosterCard';

type Show = {
  id: string;
  // v6: denormalized session range. Single-day = both equal; multi-day = range.
  firstSessionDate: Date | null;
  lastSessionDate: Date | null;
  title: string | null;
  originalPostUrl: string;
  imageUrl: string | null;
  completeness: number;
  missingFields: string[];
  stage: string | null;
  venue: { id: string; name: string } | null;
  artists: Array<{ id: string; canonicalName: string }>;
  festival: { id: string; name: string } | null;
};

export function ShowCard({ show }: { show: Show }) {
  // Card shows the first session date; range hint is on the detail page.
  const d = show.firstSessionDate ? new Date(show.firstSessionDate) : null;
  const primaryName =
    show.artists[0]?.canonicalName ?? show.title ?? '공연';
  const secondaryTitle =
    show.artists.length > 0 && show.title ? show.title : null;

  return (
    <PosterCard
      href={`/shows/${show.id}`}
      type="SHOW"
      imageUrl={show.imageUrl}
      primaryName={primaryName}
      secondaryTitle={secondaryTitle}
      city={null}
      venueName={show.venue?.name ?? null}
      date={d}
      dayLabel={formatWeekdayShort(d)}
    />
  );
}
