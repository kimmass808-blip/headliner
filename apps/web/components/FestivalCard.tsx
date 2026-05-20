import Link from 'next/link';

type Festival = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  locationText: string | null;
  posterImageUrl: string | null;
  completeness: number;
};

function formatRange(start: Date | null, end: Date | null): string {
  if (!start) return '기간 미정';
  const s = new Date(start);
  if (end) {
    const e = new Date(end);
    return `${s.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return s.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function FestivalCard({ festival }: { festival: Festival }) {
  return (
    <Link href={`/festivals/${festival.id}`} className="group block">
      <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100">
        {festival.posterImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={festival.posterImageUrl}
            alt=""
            className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-80"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white">
            <span className="text-xs uppercase tracking-widest">Festival</span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-accent">Festival</p>
        <p className="text-[15px] font-semibold text-neutral-900 group-hover:text-accent">
          {festival.name}
        </p>
        <p className="text-xs text-neutral-500">{formatRange(festival.startDate, festival.endDate)}</p>
        {festival.locationText ? (
          <p className="text-xs text-neutral-400">{festival.locationText}</p>
        ) : null}
      </div>
    </Link>
  );
}
