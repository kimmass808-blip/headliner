/**
 * 첫 로그인 동의 화면. 카카오 로그인 직후 약관 미동의자(Profile.agreedAt=null)가 도달한다.
 *  - 비로그인 접근 → 홈으로 차단
 *  - 이미 동의함 → 원래 가려던 next로 통과
 *  - 미동의 → 동의 폼 표시
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@mft/db';
import { createClient } from '../../lib/supabase/server';
import { AgreementForm } from '../../components/auth/AgreementForm';
import { LEGAL } from '../../lib/legal';

export const dynamic = 'force-dynamic'; // 세션·DB 조회 필요(캐시 불가)

export const metadata: Metadata = {
  title: '약관 동의',
  robots: { index: false, follow: false },
};

export default async function AgreePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  const supabase = await createClient();
  if (!supabase) redirect('/');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/'); // 비로그인 차단

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { agreedAt: true },
  });
  if (profile?.agreedAt) redirect(next); // 이미 동의 → 통과

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 font-sans text-paper">
      <div className="w-full max-w-md py-12">
        <h1 className="text-xl font-bold text-paper">{LEGAL.serviceName} 시작하기</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-paper/70">
          서비스 이용을 위해 약관 동의가 필요합니다. 아래 내용을 확인하고 동의해 주세요.
        </p>
        <AgreementForm next={next} />
      </div>
    </div>
  );
}
