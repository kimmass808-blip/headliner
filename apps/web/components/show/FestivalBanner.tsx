/**
 * 페스티벌 소속 표시 — Show가 Festival.shows[]의 일부일 때.
 */

import Link from 'next/link';
import { ArrowUpRight } from '../common/Icons';

export interface FestivalBannerProps {
  id: string;
  name: string;
  stage?: string | null;
}

export function FestivalBanner({ festival }: { festival: FestivalBannerProps | null }) {
  if (!festival) return null;
  return (
    <Link
      href={`/festivals/${festival.id}`}
      className="group mb-6 block"
    >
      <div className="mb-1.5 flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/55">
        <span className="h-1 w-1 rounded-full bg-paper/40" />
        PART OF FESTIVAL
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[18px] font-semibold tracking-[-0.015em] text-paper underline-offset-4 decoration-paper/40 group-hover:underline">
          {festival.name}
        </span>
        {festival.stage ? (
          <>
            <span className="text-dim">·</span>
            <span className="text-[14px] text-paper/65">{festival.stage}</span>
          </>
        ) : null}
        <ArrowUpRight className="h-4 w-4 text-paper/55 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper" />
      </div>
    </Link>
  );
}
