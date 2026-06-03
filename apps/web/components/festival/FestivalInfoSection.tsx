'use client';

/**
 * 페스티벌 관람 정보 섹션 — Festival 상세에서 라인업 아래 표시.
 * 카테고리별로 묶어 썸네일 카드 그리드로 보여주고, 카드를 누르면 IG 캐러셀
 * 원본 이미지를 라이트박스로 펼친다. 디자인: LineupSection 다크 무드와 동일.
 */

import { useState } from 'react';
import { getImageUrl } from '../../lib/imageUrl';
import { InfoLightbox } from './InfoLightbox';

type InfoCategory = 'MAP' | 'TIMETABLE' | 'ACCESS' | 'RULES' | 'FAQ' | 'GOODS' | 'AMENITY' | 'TICKET' | 'PROMO' | 'NOTICE';

export interface FestivalInfoPostData {
  id: string;
  category: InfoCategory;
  title: string | null;
  imageUrls: string[];
}

// 카테고리 한글 라벨 + 표시 순서
const CATEGORY_LABEL: Record<InfoCategory, string> = {
  TICKET: '티켓·예매',
  MAP: '사이트맵·배치도',
  TIMETABLE: '타임테이블',
  ACCESS: '교통·주차',
  RULES: '입장·반입 규정',
  FAQ: 'FAQ',
  GOODS: 'MD·푸드',
  AMENITY: '편의시설',
  PROMO: '프로모션·파트너',
  NOTICE: '안내',
};

const CATEGORY_ORDER: InfoCategory[] = ['TICKET', 'MAP', 'TIMETABLE', 'ACCESS', 'RULES', 'FAQ', 'GOODS', 'AMENITY', 'PROMO', 'NOTICE'];

export function FestivalInfoSection({ posts }: { posts: FestivalInfoPostData[] }) {
  const [active, setActive] = useState<FestivalInfoPostData | null>(null);

  if (!posts.length) return null;

  // 카테고리별 그룹핑 — 빈 카테고리는 스킵.
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: posts.filter((p) => p.category === cat),
  })).filter((g) => g.items.length);

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
      {/* heading — LineupSection과 동일한 hairline 헤더 */}
      <div className="hairline mb-8 flex flex-wrap items-end justify-between gap-y-4 pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">INFO</div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
              정보
            </h2>
            <span className="text-[14px] tabular-nums text-paper/40">{posts.length}건</span>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {grouped.map((g) => (
          <div key={g.category}>
            <h3 className="mb-5 text-[12px] uppercase tracking-[0.18em] text-paper/55">
              {CATEGORY_LABEL[g.category]}
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((p) => {
                const cover = p.imageUrls[0]
                  ? getImageUrl(p.imageUrls[0], { width: 600, quality: 80 })
                  : null;
                const caption = p.title || CATEGORY_LABEL[p.category];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActive(p)}
                    disabled={!p.imageUrls.length}
                    aria-label={`${caption} 자세히 보기`}
                    className="group text-left"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-ink-800">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={caption}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-widest text-paper/30">
                          {caption.slice(0, 2)}
                        </div>
                      )}
                      {p.imageUrls.length > 1 ? (
                        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] tabular-nums text-paper/80">
                          {p.imageUrls.length}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 truncate text-[13.5px] font-medium text-paper">{caption}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {active ? (
        <InfoLightbox
          images={active.imageUrls}
          title={active.title || CATEGORY_LABEL[active.category]}
          onClose={() => setActive(null)}
        />
      ) : null}
    </section>
  );
}
