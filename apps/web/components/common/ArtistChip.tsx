/**
 * 공통 아티스트 칩 — 라운드 사각형, 36px height, gap 8px.
 * 페스티벌 라인업·아티스트 명단 등에서 재사용.
 *
 * variant='here'는 클릭 비활성(span 렌더) — 자기 페이지를 가리키지 않도록.
 */

import Link from 'next/link';

export interface ArtistChipProps {
  name: string;
  /** 클릭 시 이동할 URL. variant='here'면 무시(비활성). */
  href?: string;
  variant?: 'default' | 'here';
}

const BASE =
  'inline-flex items-center gap-2 h-9 px-3.5 text-[14px] tracking-[-0.005em] transition';

export function ArtistChip({ name, href, variant = 'default' }: ArtistChipProps) {
  const variantCls =
    variant === 'here'
      ? 'border border-paper/70 bg-paper/[0.06] text-paper'
      : 'border border-white/15 text-paper/85 hover:border-white/40 hover:text-paper';

  const content = (
    <>
      {name}
      {variant === 'here' ? (
        <span className="-mr-1 text-[9px] uppercase tracking-[0.22em]">THIS SET</span>
      ) : null}
    </>
  );

  // 'here' 칩 또는 href 없는 경우 비활성 span으로
  if (variant === 'here' || !href) {
    return (
      <span className={`${BASE} ${variantCls}`} style={{ borderRadius: 6 }}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} className={`${BASE} ${variantCls}`} style={{ borderRadius: 6 }}>
      {content}
    </Link>
  );
}
