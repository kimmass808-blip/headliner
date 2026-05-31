/**
 * 다크 홈 그리드용 포스터 카드.
 *
 * 3:4 포스터 + 좌상단 type badge + 우상단 weekday badge + 좌하단 MM/DD.
 * 아래쪽엔 아티스트명·서브타이틀·도시·장소 메타.
 */

import Link from 'next/link';
import { getImageUrl, getImageSrcSet } from '../../lib/imageUrl';

export interface HomePosterCardProps {
  href: string;
  type: 'SHOW' | 'FESTIVAL';
  imageUrl: string | null;
  primaryName: string;        // 아티스트명 (Show) 또는 페스티벌명
  secondaryTitle?: string | null; // Show.title 또는 festival 캠페인 라벨
  city?: string | null;
  venueName?: string | null;
  date: Date | null;           // 카드의 기준 날짜
  /** day 배지 텍스트. SHOW면 'SAT' 같은 요일 약자, FESTIVAL면 '3 DAYS' 등 자유 라벨 */
  dayLabel: string | null;
}

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/** Date → 'SAT' 형식 weekday 약자 */
export function formatWeekdayShort(d: Date | null): string | null {
  if (!d) return null;
  return WEEKDAY[d.getDay()] ?? null;
}

/** Date → ['06', '14'] 형식 [MM, DD] */
function splitMonthDay(d: Date | null): [string, string] | null {
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return [mm, dd];
}

export function PosterCard(props: HomePosterCardProps) {
  const { href, type, imageUrl, primaryName, secondaryTitle, city, venueName, date, dayLabel } = props;
  const md = splitMonthDay(date);
  // 올해와 다른 년도일 때만 노출(대부분 올해라 평소엔 생략, 연말~연초 내년 공연만 구분).
  const year = date && date.getFullYear() !== new Date().getFullYear() ? date.getFullYear() : null;
  // 그리드 카드 — 3:4, 보통 한 컬럼 너비 280~360px. retina 고려해 600px 요청.
  const src = getImageUrl(imageUrl, { width: 600, quality: 78 });
  // 반응형: 모바일 2열(~45vw) ~ 데스크탑 다열(~320px). 화면/DPR에 맞춰 선택.
  const srcSet = getImageSrcSet(imageUrl, [300, 450, 600], { quality: 78 });

  return (
    <Link href={href} className="poster-card group block">
      {/* 3:4 포스터 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-ink-700">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            srcSet={srcSet}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 320px"
            alt=""
            loading="lazy"
            decoding="async"
            className="poster-img absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-paper/30">
            No poster
          </div>
        )}

        {/* 하단 어두움 그라디언트 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* 상단 badge 영역 */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
          <span
            className={
              'rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.22em] ' +
              (type === 'FESTIVAL'
                ? 'border border-paper/80 bg-black/30 font-semibold text-paper backdrop-blur-sm'
                : 'bg-white/10 text-paper/90 backdrop-blur-sm')
            }
          >
            {type}
          </span>
          {dayLabel ? (
            <span className="rounded-sm bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-paper/80 backdrop-blur-sm">
              {dayLabel}
            </span>
          ) : null}
        </div>

        {/* 좌하단 (년도 ·) MM/DD */}
        {md ? (
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex flex-col">
              {year ? (
                <span className="logo-headliner mb-1 text-[13px] leading-none text-paper/70 sm:text-[14px]">
                  {year}
                </span>
              ) : null}
              <div className="logo-headliner text-[28px] leading-none text-paper sm:text-[30px]">
                {md[0]}
                <span className="text-paper/60">/</span>
                {md[1]}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 포스터 하단 메타 */}
      <div className="mt-4 pr-2">
        <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-paper">
          {primaryName}
        </h3>
        {secondaryTitle ? (
          <p className="mt-1 line-clamp-1 text-[13px] leading-tight text-paper/55">
            {secondaryTitle}
          </p>
        ) : null}
        {(city || venueName) ? (
          <div className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.08em] text-paper/45">
            {city ? <span>{city}</span> : null}
            {city && venueName ? <span className="text-dim">·</span> : null}
            {venueName ? <span className="truncate">{venueName}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
