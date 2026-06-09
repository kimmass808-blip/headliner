import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../lib/site';

const TITLE = 'HEADLINER — 국내 인디 공연·페스티벌';

export const metadata: Metadata = {
  // 모든 상대 URL(OG 이미지·canonical)의 기준 주소. 설정 시 OG/sitemap이 절대 URL로 나간다.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // 하위 페이지에서 title을 지정하면 "공연명 · HEADLINER" 형태로 합쳐진다.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['공연', '페스티벌', '인디', '밴드', '라이브', '콘서트', '셋리스트', 'HEADLINER', '헤드라이너'],
  manifest: '/manifest.webmanifest',
  // 검색 로봇에게 색인·링크 추적을 명시적으로 허용.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: '/',
  },
  // 카카오톡·트위터 등에 링크 붙여넣을 때 보이는 미리보기 카드.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'ko_KR',
    images: [{ url: '/headliner.png', alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: ['/headliner.png'],
  },
  // 구글 서치 콘솔 소유권 확인용 토큰 (HTML 태그 방식).
  verification: { google: 'TXdnkzmO_QpOHJ36Sm--b3RuInTdavOrjV7MeyNEKn4' },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
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
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
