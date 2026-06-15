/**
 * 전역 푸터 — 모든 페이지 하단. 약관·개인정보처리방침·문의 링크 및 저작권.
 * 로그인 여부와 무관하게 표시(서버 컴포넌트, 쿠키 미사용 → 페이지 캐시 영향 없음).
 */

import Link from 'next/link';
import { LEGAL } from '../../lib/legal';

export function Footer() {
  const year = 2026; // 빌드 시 고정(동적 new Date()는 페이지 캐시·결정성에 영향 줄 수 있어 상수).

  return (
    <footer className="border-t border-paper/10 bg-ink-900">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-8 text-[13px] text-paper/50 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/terms" className="transition hover:text-paper/80">이용약관</Link>
          <Link href="/privacy" className="font-medium text-paper/70 transition hover:text-paper">
            개인정보처리방침
          </Link>
          <a href={`mailto:${LEGAL.contactEmail}`} className="transition hover:text-paper/80">
            문의
          </a>
        </div>
        <p className="text-paper/40">
          © {year} {LEGAL.serviceName}
        </p>
      </div>
    </footer>
  );
}
