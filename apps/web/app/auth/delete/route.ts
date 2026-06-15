/**
 * 회원 탈퇴 — POST 전용.
 *  1) public.Profile 삭제
 *  2) auth.users 삭제 (service role admin)
 *  3) 로컬 세션 종료 후 홈으로
 *
 * 본인만 자신을 탈퇴시킬 수 있다(현재 세션 사용자 id로만 삭제). admin 시스템과 무관.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@mft/db';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}/?auth_error=not_configured`, 303);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/`, 303);

  // 1) 프로필 삭제 (이미 없을 수도 있으니 실패 무시).
  try {
    await prisma.profile.delete({ where: { id: user.id } });
  } catch {
    // no-op
  }

  // 2) 인증 계정(auth.users) 삭제.
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.error('[auth/delete] auth 사용자 삭제 실패:', error.message);
  } else {
    console.error('[auth/delete] service role 미설정 — auth 사용자 삭제 건너뜀');
  }

  // 3) 로컬 세션 종료.
  await supabase.auth.signOut();

  return NextResponse.redirect(`${origin}/?account_deleted=1`, 303);
}
