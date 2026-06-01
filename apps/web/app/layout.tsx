import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { NavigationOverlay } from '../components/NavigationOverlay';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'HEADLINER — 국내 인디 공연·페스티벌',
  description: '전국 인디 씬 공연·페스티벌을 한 곳에서.',
  applicationName: 'HEADLINER',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'HEADLINER',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

// iOS 상태바·오버스크롤 영역 색을 페이지 배경(ink-900)과 일치시킴
export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-ink-900 text-paper antialiased">
        <Suspense fallback={null}>
          <NavigationOverlay />
        </Suspense>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
