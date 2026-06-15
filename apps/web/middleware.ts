/**
 * 미들웨어 — 두 개의 독립된 인증 레이어를 라우팅한다:
 *
 *  1) /admin/* · /api/admin/*  → 운영자(admin) 인증. mft_admin 쿠키(JWT, jose 검증).
 *                                AC-17. ADMIN_JWT_SECRET 사용. ⚠️ 기존 동작 그대로 유지.
 *  2) 그 외 모든 경로          → 일반 사용자(카카오) Supabase 세션 토큰 refresh.
 *                                리다이렉트하지 않음(lazy login — 열람은 비로그인 자유).
 *
 * 두 레이어는 쿠키 이름·시크릿이 완전히 분리되어 서로 간섭하지 않는다.
 *
 * Edge runtime이므로 bcrypt 등 Node-only 라이브러리 사용 불가.
 * jose / @supabase/ssr 는 edge-compatible.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { updateSession } from './lib/supabase/middleware';

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

/** 운영자 전용 경로 보호 (기존 로직 — 변경 없음). */
async function handleAdmin(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // /admin/login 예외 (로그인 폼은 접근 가능)
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 레이어 1: 운영자 전용 경로.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleAdmin(req);
  }

  // /api/cron/* 는 Vercel Cron 자체 보안 — 인증 미들웨어 통과(세션 갱신만).
  // 레이어 2: 그 외 모든 경로는 일반 사용자 세션 토큰만 refresh(리다이렉트 없음).
  return updateSession(req);
}

export const config = {
  // 정적 자산을 제외한 모든 경로. admin 경로도 매칭되지만 handleAdmin이 처리한다.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)',
  ],
};
