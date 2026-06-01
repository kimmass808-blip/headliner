import type { MetadataRoute } from 'next';

// PWA 설치 매니페스트. /manifest.webmanifest 로 자동 서빙된다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HEADLINER — 국내 인디 공연·페스티벌',
    short_name: 'HEADLINER',
    description: '전국 인디 씬 공연·페스티벌을 한 곳에서.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
