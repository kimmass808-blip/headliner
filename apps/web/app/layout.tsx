import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NavigationOverlay } from '../components/NavigationOverlay';

export const metadata: Metadata = {
  title: 'HEADLINER — 국내 인디 공연·페스티벌',
  description: '전국 인디 씬 공연·페스티벌을 한 곳에서.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-neutral-900 antialiased">
        <Suspense fallback={null}>
          <NavigationOverlay />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
