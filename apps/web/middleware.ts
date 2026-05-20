/**
 * AC-17 — 미인증 admin 요청 401.
 *
 * /admin/login은 예외 (로그인 폼 자체는 접근 가능).
 * 그 외 /admin/* 모두 cookie JWT 검증.
 *
 * Edge runtime이므로 bcrypt 등 Node-only 라이브러리 사용 불가.
 * jose는 edge-compatible — JWT 검증만 middleware에서.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'mft_admin';

function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET missing');
  return new TextEncoder().encode(secret);
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/login 예외 (로그인 폼은 접근 가능)
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  // /api/cron/* 는 Vercel Cron 자체 보안 (Vercel 인증 헤더로 구분)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const authed = await isAuthenticated(req);
  if (!authed) {
    // API 요청은 401 JSON, 페이지 요청은 login 리다이렉트
    if (pathname.startsWith('/api/admin/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
