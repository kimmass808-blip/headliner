/**
 * Artist 헤로 — 좌 프로필 정사각 + 우 (kicker / 이름 / aliases / 외부 링크).
 */

import Link from 'next/link';
import { ExternalLinks, type ExternalLink } from '../common/ExternalLinks';
import { ArtistPortrait } from './ArtistPortrait';

export interface HeroSectionProps {
  name: string;
  aliases: string[];
  photo: string | null;
  links: ExternalLink[];
  /** 셋리스트 모음 페이지 경로. 지정 시 외부 링크 아래에 진입 버튼 표시. */
  setlistsHref?: string | null;
}

export function HeroSection({ name, aliases, photo, links, setlistsHref }: HeroSectionProps) {
  return (
    <section className="mx-auto mt-6 max-w-[1400px] px-6 sm:mt-8 sm:px-10">
      <div className="grid grid-cols-[112px_1fr] items-start gap-6 sm:grid-cols-[180px_1fr] sm:gap-10 lg:grid-cols-[280px_1fr] lg:gap-14">
        <ArtistPortrait photo={photo} name={name} />

        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-paper/50">
            <span className="h-1 w-1 rounded-full bg-paper/40" />
            ARTIST
          </div>

          <h1 className="mt-3 break-keep text-[32px] font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:mt-5 sm:text-[56px] lg:text-[72px]">
            {name}
          </h1>

          {aliases.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-paper/55 sm:mt-4">
              {aliases.map((a, i) => (
                <span key={a} className="flex items-center gap-x-2">
                  <span>{a}</span>
                  {i < aliases.length - 1 ? <span className="text-dim">·</span> : null}
                </span>
              ))}
            </div>
          ) : null}

          <ExternalLinks links={links} />

          {setlistsHref ? (
            <Link
              href={setlistsHref}
              className="group mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] uppercase tracking-[0.18em] text-paper/70 transition hover:border-white/30 hover:text-paper"
            >
              셋리스트 모아보기
              <svg
                className="h-4 w-4 transition group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
