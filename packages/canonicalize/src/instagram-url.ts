const IG_HOST_PATTERN = /^(?:https?:\/\/)?(?:www\.)?instagram\.com(\/.*)?$/i;
const IG_POST_PATTERN = /^\/p\/([A-Za-z0-9_\-]+)\/?$/;
const IG_REEL_PATTERN = /^\/reel\/([A-Za-z0-9_\-]+)\/?$/;
// IG는 username을 path에 포함하는 형태도 허용: /{username}/p/{shortcode}/ 또는 /{username}/reel/{shortcode}/
const IG_USER_POST_PATTERN = /^\/[a-zA-Z0-9._]{1,30}\/p\/([A-Za-z0-9_\-]+)\/?$/;
const IG_USER_REEL_PATTERN = /^\/[a-zA-Z0-9._]{1,30}\/reel\/([A-Za-z0-9_\-]+)\/?$/;
const IG_PROFILE_PATTERN = /^\/([a-zA-Z0-9._]{1,30})\/?$/;

export function canonicalizeInstagramUrl(url: string): string {
  const trimmed = url.trim();

  if (!IG_HOST_PATTERN.test(trimmed)) {
    throw new Error(`Not an Instagram URL: ${url}`);
  }

  // Parse the URL, defaulting to https if no protocol
  const withProtocol = trimmed.replace(/^http:\/\//i, 'https://').replace(/^(?!https?:\/\/)/i, 'https://');

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`Invalid Instagram URL: ${url}`);
  }

  // Ensure canonical host
  if (!parsed.hostname.toLowerCase().includes('instagram.com')) {
    throw new Error(`Not an Instagram URL: ${url}`);
  }

  const pathname = parsed.pathname;

  // Match /p/{shortcode} 또는 /{user}/p/{shortcode}
  const postMatch = IG_POST_PATTERN.exec(pathname) ?? IG_USER_POST_PATTERN.exec(pathname);
  if (postMatch) {
    return `https://www.instagram.com/p/${postMatch[1]}/`;
  }

  // Match /reel/{shortcode} 또는 /{user}/reel/{shortcode}
  const reelMatch = IG_REEL_PATTERN.exec(pathname) ?? IG_USER_REEL_PATTERN.exec(pathname);
  if (reelMatch) {
    return `https://www.instagram.com/reel/${reelMatch[1]}/`;
  }

  // Match profile /{handle}
  const profileMatch = IG_PROFILE_PATTERN.exec(pathname);
  if (profileMatch) {
    return `https://www.instagram.com/${profileMatch[1]}/`;
  }

  throw new Error(`Unrecognized Instagram URL pattern: ${url}`);
}
