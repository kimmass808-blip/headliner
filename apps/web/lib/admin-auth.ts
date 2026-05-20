/**
 * Admin 인증 헬퍼 (AC-13, AC-17).
 *
 * V1: 단일 ENV password (bcrypt hash) + jose JWT httpOnly cookie (7일).
 * `AdminUser` 테이블 없음. 운영자 1인 가정.
 * V2 follow-up: 다인 admin + audit log (ADR Follow-ups #10).
 */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'mft_admin';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7일 (초)

function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_JWT_SECRET 환경 변수가 없거나 너무 짧습니다 (32+ 권장)');
  }
  return new TextEncoder().encode(secret);
}

/** 평문 password를 ENV의 bcrypt hash와 비교 */
export async function verifyAdminPassword(plain: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    throw new Error('ADMIN_PASSWORD_HASH 환경 변수가 설정되지 않았습니다');
  }
  return bcrypt.compare(plain, hash);
}

/** JWT 발급 + httpOnly Secure SameSite=Strict cookie 설정 */
export async function issueAdminToken(): Promise<void> {
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

/** 쿠키에서 token 추출 후 검증. 유효하면 true, 아니면 false. */
export async function verifyAdminCookie(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

/** 서버 컴포넌트에서 빠른 인증 체크 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyAdminCookie(token);
}

/** 로그아웃 — 쿠키 삭제 */
export async function clearAdminToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
