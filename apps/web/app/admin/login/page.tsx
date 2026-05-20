/**
 * AC-13 — Admin 로그인 페이지.
 * 단일 ENV password (bcrypt hash) → 성공 시 jose JWT httpOnly cookie 발급.
 */

import { redirect } from 'next/navigation';
import { verifyAdminPassword, issueAdminToken } from '../../../lib/admin-auth';

interface SearchParams {
  redirect?: string;
  error?: string;
}

async function loginAction(formData: FormData) {
  'use server';
  const password = formData.get('password')?.toString() ?? '';
  const redirectTo = (formData.get('redirect')?.toString() || '/admin') as string;

  if (!password) {
    redirect(`/admin/login?error=empty&redirect=${encodeURIComponent(redirectTo)}`);
  }

  let valid = false;
  try {
    valid = await verifyAdminPassword(password);
  } catch (e) {
    redirect(`/admin/login?error=config&redirect=${encodeURIComponent(redirectTo)}`);
  }

  if (!valid) {
    redirect(`/admin/login?error=invalid&redirect=${encodeURIComponent(redirectTo)}`);
  }

  await issueAdminToken();
  redirect(redirectTo);
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { redirect: redirectTo = '/admin', error } = await searchParams;
  const errorMessage =
    error === 'invalid'
      ? '비밀번호가 일치하지 않습니다.'
      : error === 'empty'
      ? '비밀번호를 입력하세요.'
      : error === 'config'
      ? '서버 설정 오류 — ADMIN_PASSWORD_HASH·ADMIN_JWT_SECRET을 확인하세요.'
      : null;

  return (
    <main className="container mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold">관리자 로그인</h1>
      <p className="mt-1 text-sm text-zinc-500">MFT 운영자 전용</p>

      <form action={loginAction} className="mt-8 space-y-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <div>
          <label className="block text-sm font-medium text-zinc-700">비밀번호</label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </div>
        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
