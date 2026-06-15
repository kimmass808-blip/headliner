/**
 * 계정 페이지 (마이페이지의 시작점). 현재는 프로필 표시 + 회원 탈퇴.
 * 추후: 닉네임 수정, 내가 올린 사진/글, 스크랩 등 탭으로 확장.
 *
 * 비로그인 접근 → 홈으로 차단.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@mft/db';
import { HomeHeader } from '../../components/home/Header';
import { createClient } from '../../lib/supabase/server';
import { DeleteAccountButton } from '../../components/auth/DeleteAccountButton';

export const dynamic = 'force-dynamic'; // 세션·DB 조회 필요

export const metadata: Metadata = {
  title: '계정',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/'); // 비로그인 차단

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { nickname: true, avatarUrl: true },
  });

  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-md px-6 py-12 sm:px-10">
        <h1 className="text-xl font-bold text-paper">계정</h1>

        <div className="mt-6 flex items-center gap-4">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper/15 text-lg text-paper">
              {(profile?.nickname ?? '?').slice(0, 1)}
            </span>
          )}
          <div>
            <p className="text-[15px] font-semibold text-paper">
              {profile?.nickname ?? '사용자'}
            </p>
            <p className="text-[13px] text-paper/50">카카오 계정으로 로그인됨</p>
          </div>
        </div>

        <div className="mt-10 border-t border-paper/10 pt-6">
          <h2 className="text-[13px] font-medium text-paper/60">계정 관리</h2>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="text-[14px] text-paper/80 underline transition hover:text-paper"
            >
              로그아웃
            </button>
          </form>
          <div className="mt-4">
            <DeleteAccountButton />
          </div>
        </div>
      </main>
    </div>
  );
}
