/**
 * 공연 사진 올리기 진입점 — lazy login 게이트 placeholder.
 *
 * 이번 작업 범위는 "로그인까지". 실제 업로드 기능은 다음 작업이다.
 * 기여 행동(사진 올리기) 진입점에서만 로그인을 요구하는 패턴의 "자리"만 잡아둔다:
 *   - 비로그인: 클릭 시 카카오 로그인 유도(끝나면 이 페이지로 복귀).
 *   - 로그인:   "곧 제공" 안내(업로드는 다음 작업).
 *   - 미설정(anon key 없음): 렌더 안 함.
 *
 * 세션은 브라우저에서 직접 읽는다 → 공연 상세 페이지(ISR 캐시)는 동적 렌더로 떨어지지 않는다.
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export function PhotoUploadGate() {
  const pathname = usePathname();
  const [configured, setConfigured] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return; // 미설정 — 렌더 안 함.
    setConfigured(true);
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setIsLoggedIn(data.user !== null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(session?.user != null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleClick() {
    if (isLoggedIn) {
      setNotice('사진 업로드 기능은 곧 제공됩니다. 🙌');
      return;
    }
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
      console.error('[PhotoUploadGate] 로그인 시작 실패:', error);
      setLoading(false);
    }
  }

  if (!configured) return null;

  return (
    <section className="mx-auto mt-12 max-w-[1400px] px-6 sm:px-10">
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-paper/10 bg-paper/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-paper">이 공연에 다녀오셨나요?</h2>
          <p className="mt-1 text-[13px] text-paper/60">
            {isLoggedIn
              ? '현장 사진을 올려 다른 관람객과 공유해보세요.'
              : '로그인하면 현장 사진을 올려 공유할 수 있어요.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="shrink-0 rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink-900 transition hover:bg-paper/90 disabled:opacity-60"
        >
          {loading ? '연결 중…' : isLoggedIn ? '사진 올리기' : '로그인하고 사진 올리기'}
        </button>
      </div>
      {notice ? <p className="mt-2 px-1 text-[13px] text-paper/60">{notice}</p> : null}
    </section>
  );
}
