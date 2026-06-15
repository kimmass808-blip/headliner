'use server';

/**
 * 약관 동의 기록 서버 액션. 첫 로그인 동의 화면(/agree)에서 호출.
 * 현재 로그인 사용자의 Profile에 동의 시각·버전을 기록하고 원래 가려던 페이지로 보낸다.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@mft/db';
import { createClient } from '../../lib/supabase/server';
import { LEGAL } from '../../lib/legal';

export async function recordAgreement(formData: FormData) {
  const nextRaw = formData.get('next');
  // open redirect 방지: 내부 경로만 허용.
  const next = typeof nextRaw === 'string' && nextRaw.startsWith('/') ? nextRaw : '/';

  const supabase = await createClient();
  if (!supabase) redirect('/?auth_error=not_configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/'); // 비로그인 → 차단

  await prisma.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, agreedAt: new Date(), agreedVersion: LEGAL.version },
    update: { agreedAt: new Date(), agreedVersion: LEGAL.version },
  });

  redirect(next);
}
