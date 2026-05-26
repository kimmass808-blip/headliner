/**
 * 상세 페이지 상단의 "← 검색으로" 링크.
 * 단순화를 위해 router.back() 대신 홈 라우팅 — 홈에 검색바가 있으므로 의미상 동일.
 */

import Link from 'next/link';
import { ArrowLeft } from './Icons';

export function BackLink({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-paper/55 transition hover:text-paper"
    >
      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
      검색으로
    </Link>
  );
}
