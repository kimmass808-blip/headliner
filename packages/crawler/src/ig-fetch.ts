/**
 * IG 공개 게시물 fetch — best-effort 스켈레톤 (AC-1, Phase 1.1)
 *
 * 2단 전략:
 *   1차: JSON 엔드포인트 (`?__a=1&__d=dis`) 시도
 *   Fallback: HTML fetch + cheerio (og:description, og:image, ld+json)
 *
 * 실제 IG fetch는 차단·구조 변동이 잦으므로 best-effort.
 * 모든 에러는 graceful하게 status='error'로 반환.
 */

import * as cheerio from 'cheerio';
import { canonicalizeInstagramUrl } from '@mft/canonicalize';

export interface FetchedPost {
  canonicalUrl: string;      // canonicalizeInstagramUrl 적용 후
  sourceAccount: string;     // 게시한 계정 핸들
  postedAt: Date;
  rawText: string;           // 캡션 본문
  imageUrls: string[];
  status: 'success' | 'not_found' | 'blocked' | 'error';
}

export interface FetchAccountResult {
  accountHandle: string;
  posts: FetchedPost[];
  errors: Array<{ url: string; reason: string }>;
  httpStatus: number | null; // 마지막 응답 상태 (AC-18 차단 감지용)
}

/** IG JSON 엔드포인트 응답 구조 (변동 가능) */
interface IgJsonResponse {
  graphql?: {
    shortcode_media?: {
      taken_at_timestamp?: number;
      edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
      display_url?: string;
      edge_sidecar_to_children?: { edges?: Array<{ node?: { display_url?: string } }> };
      owner?: { username?: string };
    };
  };
}

const USER_AGENT =
  process.env.IG_FETCH_USER_AGENT ??
  'Mozilla/5.0 (compatible; MFT-Crawler/1.0)';

/** shortcode로 게시물 1건 fetch — JSON 엔드포인트 우선, fallback HTML */
async function fetchPost(shortcode: string, igHandle: string): Promise<FetchedPost> {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
  const canonicalUrl = canonicalizeInstagramUrl(postUrl);

  // 1차: JSON 엔드포인트
  try {
    const jsonUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'not_found' };
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'blocked' };
    }

    if (res.ok) {
      const json = (await res.json()) as IgJsonResponse;
      const media = json?.graphql?.shortcode_media;
      if (media) {
        const rawText =
          media.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';
        const imageUrls: string[] = [];
        if (media.display_url) imageUrls.push(media.display_url);
        const sidecar = media.edge_sidecar_to_children?.edges ?? [];
        for (const e of sidecar) {
          if (e.node?.display_url) imageUrls.push(e.node.display_url);
        }
        const ts = media.taken_at_timestamp;
        const postedAt = ts ? new Date(ts * 1000) : new Date();
        const account = media.owner?.username ?? igHandle;
        return { canonicalUrl, sourceAccount: account, postedAt, rawText, imageUrls, status: 'success' };
      }
    }
  } catch {
    // JSON 엔드포인트 실패 → HTML fallback으로 진행
  }

  // Fallback: HTML + cheerio
  try {
    const res = await fetch(postUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'not_found' };
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'blocked' };
    }

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // og:description → 캡션 추출
      const rawText =
        $('meta[property="og:description"]').attr('content') ?? '';

      // og:image → 대표 이미지
      const imageUrls: string[] = [];
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) imageUrls.push(ogImage);

      // ld+json에서 날짜 추출 시도
      let postedAt = new Date();
      const ldJson = $('script[type="application/ld+json"]').first().text();
      if (ldJson) {
        try {
          const ld = JSON.parse(ldJson) as Record<string, unknown>;
          const ts = ld['uploadDate'] ?? ld['datePublished'];
          if (typeof ts === 'string') postedAt = new Date(ts);
        } catch {
          // ld+json 파싱 실패 무시
        }
      }

      return { canonicalUrl, sourceAccount: igHandle, postedAt, rawText, imageUrls, status: 'success' };
    }

    return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'error' };
  } catch {
    return { canonicalUrl, sourceAccount: igHandle, postedAt: new Date(), rawText: '', imageUrls: [], status: 'error' };
  }
}

/**
 * IG 계정의 게시물 목록 fetch.
 * AC-1: active=≤50, pending=≤5 (maxPosts로 제어).
 * sinceTimestamp 이후 게시물만 반환.
 *
 * 주의: IG 공개 계정 게시물 목록 API는 공식 지원 없음.
 * 현재 구현은 프로필 HTML에서 shortcode 추출 시도 (best-effort).
 * 차단·구조 변동 시 FetchAccountResult.httpStatus로 감지.
 */
export async function fetchAccountPosts(
  igHandle: string,
  opts: { sinceTimestamp?: Date; maxPosts: number },
): Promise<FetchAccountResult> {
  const result: FetchAccountResult = {
    accountHandle: igHandle,
    posts: [],
    errors: [],
    httpStatus: null,
  };

  const profileUrl = `https://www.instagram.com/${igHandle}/`;

  try {
    // 프로필 페이지에서 최신 게시물 shortcode 추출 (best-effort)
    const res = await fetch(profileUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });

    result.httpStatus = res.status;

    if (res.status === 404) {
      // 계정 없음 — 정상적인 not_found
      return result;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      // 차단 감지 (AC-18)
      return result;
    }

    if (!res.ok) {
      result.errors.push({ url: profileUrl, reason: `HTTP ${res.status}` });
      return result;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // IG 프로필 페이지에서 shortcode 목록 추출 (구조 변동 가능)
    const shortcodes: string[] = [];

    // 방법 1: href="/p/{shortcode}/" 링크 수집
    $('a[href^="/p/"]').each((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/^\/p\/([A-Za-z0-9_-]+)\//);
      if (match?.[1] && !shortcodes.includes(match[1])) {
        shortcodes.push(match[1]);
      }
    });

    // 방법 2: __additionalData__ / window._sharedData 스크립트 파싱
    if (shortcodes.length === 0) {
      $('script').each((_i, el) => {
        const text = $(el).text();
        const matches = text.matchAll(/"shortcode"\s*:\s*"([A-Za-z0-9_-]+)"/g);
        for (const m of matches) {
          if (m[1] && !shortcodes.includes(m[1])) {
            shortcodes.push(m[1]);
          }
        }
      });
    }

    // maxPosts 제한 적용 후 게시물별 fetch
    const limited = shortcodes.slice(0, opts.maxPosts);
    for (const code of limited) {
      const postUrl = `https://www.instagram.com/p/${code}/`;
      try {
        const post = await fetchPost(code, igHandle);

        // sinceTimestamp 필터
        if (opts.sinceTimestamp && post.postedAt <= opts.sinceTimestamp) {
          continue;
        }

        result.posts.push(post);

        // 차단 감지 시 즉시 중단
        if (post.status === 'blocked') {
          result.httpStatus = 429;
          break;
        }
      } catch (err) {
        result.errors.push({
          url: postUrl,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    result.errors.push({
      url: profileUrl,
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
