/**
 * Supabase Auth 사용자 메타데이터 → 프로필 표시 필드 추출 (서버/클라이언트 공용 순수 함수).
 *
 * 카카오 provider는 닉네임/아바타를 여러 키로 줄 수 있어(name·nickname·full_name·user_name·
 * preferred_username / avatar_url·picture) 폴백 순서로 뽑는다.
 *
 * ⚠️ 카카오 CDN 아바타는 http:// 로 오는 경우가 있는데, https 사이트(프로덕션)에선
 * 혼합 콘텐츠로 브라우저가 차단한다 → https로 강제 승격한다.
 */

export interface ProfileFields {
  nickname: string | null;
  avatarUrl: string | null;
}

function toHttps(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http://') ? 'https://' + url.slice('http://'.length) : url;
}

export function extractProfileFields(
  meta: Record<string, unknown> | null | undefined,
): ProfileFields {
  const m = meta ?? {};
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  };

  return {
    nickname: pick('name', 'nickname', 'full_name', 'user_name', 'preferred_username'),
    avatarUrl: toHttps(pick('avatar_url', 'picture')),
  };
}
