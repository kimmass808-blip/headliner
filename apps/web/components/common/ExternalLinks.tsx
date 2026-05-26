/**
 * 외부 링크 아이콘 버튼 행 — 헤더 검색 버튼과 같은 40×40 원형, border-soft.
 */

import { PlatformIcon, PLATFORM_LABELS, type PlatformKind } from './PlatformIcon';

export interface ExternalLink {
  kind: PlatformKind;
  /** aria-label/title용 (예: '@silicagel.official') */
  label: string;
  url: string;
}

export function ExternalLinks({ links }: { links: ExternalLink[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="mt-7 flex flex-wrap items-center gap-2">
      {links.map((l) => (
        <a
          key={`${l.kind}-${l.url}`}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${PLATFORM_LABELS[l.kind] ?? l.kind} — ${l.label}`}
          title={`${PLATFORM_LABELS[l.kind] ?? l.kind} · ${l.label}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-paper/70 transition hover:border-white/30 hover:text-paper"
        >
          <PlatformIcon kind={l.kind} className="h-[18px] w-[18px]" />
        </a>
      ))}
    </div>
  );
}
