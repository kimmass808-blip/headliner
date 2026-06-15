/**
 * 첫 로그인 동의 폼 (클라이언트). 이용약관·개인정보처리방침 두 항목을 모두 체크해야
 * '동의하고 시작하기'가 활성화된다. 제출 시 서버 액션이 동의를 기록하고 원래 페이지로 보낸다.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { recordAgreement } from '../../app/agree/actions';

export function AgreementForm({ next }: { next: string }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const allChecked = terms && privacy;

  return (
    <form
      action={recordAgreement}
      onSubmit={() => setSubmitting(true)}
      className="mt-8 space-y-4"
    >
      <input type="hidden" name="next" value={next} />

      <button
        type="button"
        onClick={() => {
          const v = !allChecked;
          setTerms(v);
          setPrivacy(v);
        }}
        className="w-full rounded-xl border border-paper/15 px-4 py-3 text-left text-[14px] font-medium text-paper transition hover:bg-paper/[0.04]"
      >
        <span className="mr-2">{allChecked ? '☑' : '☐'}</span> 약관 전체 동의
      </button>

      <label className="flex items-start gap-3 px-1 text-[14px] text-paper/80">
        <input
          type="checkbox"
          required
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-paper"
        />
        <span>
          (필수){' '}
          <Link href="/terms" target="_blank" className="underline hover:text-paper">
            이용약관
          </Link>
          에 동의합니다.
        </span>
      </label>

      <label className="flex items-start gap-3 px-1 text-[14px] text-paper/80">
        <input
          type="checkbox"
          required
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-paper"
        />
        <span>
          (필수){' '}
          <Link href="/privacy" target="_blank" className="underline hover:text-paper">
            개인정보처리방침
          </Link>
          에 동의합니다.
        </span>
      </label>

      <button
        type="submit"
        disabled={!allChecked || submitting}
        className="w-full rounded-full bg-[#FEE500] px-4 py-3 text-[14px] font-semibold text-[#191600] transition hover:brightness-95 disabled:opacity-50"
      >
        {submitting ? '처리 중…' : '동의하고 시작하기'}
      </button>
    </form>
  );
}
