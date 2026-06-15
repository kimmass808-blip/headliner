/**
 * 카카오 OAuth 콜백 — Supabase가 인증 후 이 경로로 사용자를 돌려보낸다.
 *
 * 흐름:
 *   1) 쿼리의 `code`를 세션으로 교환(exchangeCodeForSession) → 인증 쿠키 설정.
 *   2) 인증된 사용자의 카카오 메타데이터로 public.Profile 을 upsert(첫 로그인만 생성, 재로그인 중복 없음).
 *   3) 약관 미동의자(agreedAt=null)는 /agree 로 유도, 동의자는 원래 보던 페이지(`next`)로 복귀.
 *
 * admin 시스템과 무관 — 별개의 Supabase 세션 쿠키만 다룬다.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@mft/db';
import { createClient } from '../../../lib/supabase/server';
import { extractProfileFields } from '../../../lib/supabase/profile';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // open redirect 방지: 같은 사이트 내부 경로만 허용.
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=exchange_failed`);
  }

  // 인증된 사용자 → Profile upsert. 실패해도 로그인 자체는 성공이므로 흐름은 막지 않는다.
  let needsAgreement = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { nickname, avatarUrl } = extractProfileFields(user.user_metadata);

      const profile = await prisma.profile.upsert({
        where: { id: user.id },
        create: { id: user.id, nickname, avatarUrl },
        update: { nickname, avatarUrl },
      });
      // 약관 미동의(첫 가입 또는 기존 미동의자) → 동의 화면으로 유도.
      needsAgreement = profile.agreedAt === null;
    }
  } catch (e) {
    console.error('[auth/callback] Profile upsert 실패:', e);
  }

  if (needsAgreement) {
    return NextResponse.redirect(`${origin}/agree?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
