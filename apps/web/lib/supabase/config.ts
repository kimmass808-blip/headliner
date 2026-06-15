/**
 * Supabase 공개(anon) 설정 — 클라이언트/서버 공용.
 *
 * 일반 사용자 로그인(카카오)은 Supabase Auth 위에 올라간다. 여기서 읽는 두 값은
 * 브라우저에 노출되어도 안전한 공개 키다(서비스 롤 키와 다름):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * ⚠️ 외부 설정(Supabase 대시보드에서 anon key 발급) 전까지 이 값이 비어 있을 수 있다.
 * 그 경우 `isAuthConfigured()`가 false를 돌려주고, 로그인 UI는 비활성 상태로 떨어진다 —
 * 사이트 열람(비로그인)은 영향 없이 그대로 동작. 설정이 끝나면 자동으로 켜진다.
 *
 * admin(mft_admin 쿠키 / ADMIN_JWT_SECRET) 인증과는 완전히 별개 레이어다.
 */

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** 카카오 로그인이 켜질 수 있는 상태인지(공개 env 두 개가 모두 채워졌는지). */
export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
