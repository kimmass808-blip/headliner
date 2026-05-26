/**
 * 외부 링크 플랫폼별 아이콘 — kind에 따라 SVG를 반환.
 * Headliner 톤(lucide 스타일, stroke 1.6)으로 단순화한 line icon.
 */

import type { ReactElement } from 'react';

export type PlatformKind =
  | 'instagram'
  | 'website'
  | 'youtube'
  | 'spotify'
  | 'bandcamp'
  | 'twitter';

type IconProps = { className?: string };

function IconInstagram({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function IconWebsite({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 010 18" />
      <path d="M12 3a14 14 0 000 18" />
    </svg>
  );
}

function IconYouTube({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSpotify({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M7 10.5c3-1 7-1 10 0.5" />
      <path d="M7.5 13.5c2.5-0.8 5.5-0.6 8 0.7" />
      <path d="M8 16.3c2-0.6 4-0.4 6 0.4" />
    </svg>
  );
}

function IconGeneric({ className = '' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
    </svg>
  );
}

const ICONS: Record<PlatformKind, (p: IconProps) => ReactElement> = {
  instagram: IconInstagram,
  website: IconWebsite,
  youtube: IconYouTube,
  spotify: IconSpotify,
  bandcamp: IconGeneric,
  twitter: IconGeneric,
};

export function PlatformIcon({ kind, className = '' }: { kind: PlatformKind; className?: string }) {
  const Icon = ICONS[kind] ?? IconGeneric;
  return <Icon className={className} />;
}

export const PLATFORM_LABELS: Record<PlatformKind, string> = {
  instagram: 'Instagram',
  website: 'Website',
  youtube: 'YouTube',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  twitter: 'X (Twitter)',
};
