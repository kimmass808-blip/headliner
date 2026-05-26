/**
 * FestivalCard — 검색 결과 그리드용 thin adapter.
 *
 * 시각 사양은 `components/home/PosterCard`에 단일화. 이 파일은 매핑만.
 */

import { PosterCard, formatWeekdayShort } from './home/PosterCard';

type Festival = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  locationText: string | null;
  posterImageUrl: string | null;
  completeness: number;
};

function festivalDayLabel(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  if (end && end.getTime() !== start.getTime()) {
    const diff =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${diff} DAYS`;
  }
  return formatWeekdayShort(start);
}

export function FestivalCard({ festival }: { festival: Festival }) {
  const start = festival.startDate ? new Date(festival.startDate) : null;
  const end = festival.endDate ? new Date(festival.endDate) : null;

  return (
    <PosterCard
      href={`/festivals/${festival.id}`}
      type="FESTIVAL"
      imageUrl={festival.posterImageUrl}
      primaryName={festival.name}
      secondaryTitle={null}
      city={null}
      venueName={festival.locationText ?? null}
      date={start}
      dayLabel={festivalDayLabel(start, end)}
    />
  );
}
