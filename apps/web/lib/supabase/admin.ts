/**
 * 서버 전용 Supabase 관리자 클라이언트 (service role 키 사용).
 *
 * ⚠️ 절대 클라이언트 컴포넌트/브라우저에서 import 금지. service role 키는 RLS를 우회하므로
 *    route handler / server action 에서만 사용한다. 회원 탈퇴 시 auth.users 삭제에 쓴다.
 *
 * env 미설정 시 null.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
