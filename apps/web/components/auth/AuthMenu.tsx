/**
 * 헤더 로그인 상태 UI (클라이언트 컴포넌트, 자급식).
 *
 * 세션을 **브라우저에서** 직접 읽는다 → 서버 컴포넌트가 쿠키를 읽지 않으므로
 * shows/festivals 등 ISR 캐시 페이지가 동적 렌더로 떨어지지 않는다(캐시 유지).
 *
 *  - 비로그인: "로그인" 버튼 → 카카오 OAuth 시작. 끝나면 보던 페이지로 복귀.
 *  - 로그인:   닉네임/아바타 + "로그아웃"(POST /auth/signout).
 *  - 미설정(anon key 없음) / 로딩 중: 아무것도 렌더하지 않음.
 *
 * 열람은 전부 로그인 불요(lazy login).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import { extractProfileFields, type ProfileFields } from '../../lib/supabase/profile';

function toAuthUser(user: User | null): ProfileFields | null {
  if (!user) return null;
  return extractProfileFields(user.user_metadata as Record<string, unknown>);
}

export function AuthMenu() {
  const pathname = usePathname();
  const [user, setUser] = useState<ProfileFields | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(false);
      return;
    }
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(toAuthUser(data.user));
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null));
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const next = pathname && pathname.startsWith('/') ? pathname : '/';
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo },
    });
    if (error) {
      console.error('[AuthMenu] 카카오 로그인 시작 실패:', error);
      setLoading(false);
    }
    // 성공 시 카카오로 리다이렉트되므로 이 컴포넌트는 언마운트됨.
  }

  // 미설정 또는 세션 확인 전에는 아무것도 표시하지 않음(깜빡임 방지).
  if (!ready) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2.5">
        <Link
          href="/account"
          className="flex items-center gap-2.5 transition hover:opacity-80"
          aria-label="계정"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/15 text-[12px] text-paper">
              {(user.nickname ?? '?').slice(0, 1)}
            </span>
          )}
          <span className="hidden max-w-[7rem] truncate text-[13px] text-paper/80 sm:inline">
            {user.nickname ?? '사용자'}
          </span>
        </Link>
        <form action="/auth/signout" method="post" className="inline">
          <button
            type="submit"
            className="text-[13px] text-paper/50 transition hover:text-paper/80"
          >
            로그아웃
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className="rounded-full bg-[#FEE500] px-3.5 py-1.5 text-[13px] font-medium text-[#191600] transition hover:brightness-95 disabled:opacity-60"
    >
      {loading ? '연결 중…' : '로그인'}
    </button>
  );
}
