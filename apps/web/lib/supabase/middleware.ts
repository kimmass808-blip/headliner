/**
 * 일반 사용자 세션 토큰 갱신용 미들웨어 헬퍼.
 *
 * Supabase Auth의 access token은 만료되므로, 매 요청마다 미들웨어에서 refresh해
 * 갱신된 쿠키를 응답에 실어 보낸다(서버 컴포넌트가 항상 최신 세션을 읽도록).
 *
 * ⚠️ admin 인증(mft_admin / ADMIN_JWT_SECRET)과는 무관하다. 이 헬퍼는 /admin 경로에서는
 *    호출되지 않으며(미들웨어 라우팅 참고), 사용자를 리다이렉트하지도 않는다(lazy login —
 *    열람은 비로그인 자유). 단순히 세션 쿠키만 최신으로 유지한다.
 *
 * env 미설정 시엔 아무것도 하지 않고 그대로 통과시킨다.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './config';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const config = getSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser()를 호출해야 만료 토큰이 refresh된다(setAll 콜백을 통해 새 쿠키가 응답에 실림).
  await supabase.auth.getUser();

  return response;
}
