/**
 * 브라우저용 Supabase 클라이언트 (클라이언트 컴포넌트 전용).
 *
 * 카카오 로그인 시작(signInWithOAuth)·로그아웃(signOut)에 사용한다.
 * env가 아직 설정되지 않았으면 null을 돌려준다 — 호출부에서 로그인 버튼을 비활성 처리.
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
