/**
 * 서버용 Supabase 클라이언트 (서버 컴포넌트 / route handler / server action 전용).
 *
 * Next.js 쿠키 저장소와 연동해 세션을 읽고 갱신한다. env 미설정 시 null.
 *
 * 주의: 서버 컴포넌트에서는 쿠키 쓰기가 불가능(read-only)하므로 set이 throw할 수 있다.
 * 그 경우는 무시한다 — 세션 토큰 갱신은 미들웨어(updateSession)가 책임진다.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 호출되면 쿠키 쓰기가 막혀 throw — 미들웨어가 갱신을 맡으므로 무시.
        }
      },
    },
  });
}

/**
 * 현재 로그인 사용자(인증된 카카오 사용자)를 돌려준다. 비로그인/미설정이면 null.
 * 헤더의 로그인 상태 표시에 사용. getUser()는 Auth 서버에 토큰을 검증시킨다(getSession보다 안전).
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
