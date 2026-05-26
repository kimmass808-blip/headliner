/**
 * 상세 페이지의 메타 dl row (label 110px / value 가변, hairline 구분선).
 * Show / Festival / Artist 상세에서 공통으로 사용.
 */

import type { ReactNode } from 'react';

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hairline grid grid-cols-[110px_1fr] gap-4 py-4">
      <dt className="self-center text-[11px] uppercase tracking-[0.25em] text-paper/45">
        {label}
      </dt>
      <dd className="text-[15px] leading-snug text-paper">{children}</dd>
    </div>
  );
}
