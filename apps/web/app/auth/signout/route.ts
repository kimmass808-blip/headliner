/**
 * 로그아웃 — Supabase 세션을 끝내고 인증 쿠키를 비운 뒤 원래 페이지로 복귀.
 * POST 전용(CSRF 안전). admin 로그아웃과 무관.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const referer = request.headers.get('referer');
  // 같은 출처의 페이지로만 복귀(open redirect 방지). 없으면 홈.
  const back = referer && referer.startsWith(origin) ? referer : `${origin}/`;

  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(back, { status: 303 });
}
