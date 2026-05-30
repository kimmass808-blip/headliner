/**
 * Shared image-to-Supabase pipeline used by both migration and ingest flows.
 *
 *   downloadToBuffer(urlOrPath)   -> Buffer
 *   normalize(buffer)             -> { buffer, ext, width, height, hash } (webp, ≤1200px wide)
 *   upload(normalized)            -> publicUrl  (idempotent by content hash)
 *
 * The bucket "posters" must exist (public read). Files are stored at
 * `${hash}.webp` so the same image used by multiple shows uploads exactly once.
 *
 * On upload failure (network etc.), the caller decides whether to fall back to
 * the original URL or skip — we just throw.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'posters';
// 원본 저장 한도. Instagram CDN이 통상 ~1440px까지 서빙하므로 그 상한선을 그대로 따른다.
// 웹사이트에선 Supabase Image Transformation 으로 클라이언트가 요청한 width로 동적 리사이즈해 받음.
const MAX_WIDTH = 1440;
const WEBP_QUALITY = 82;
// 다운로드 상한 — 디컴프레션 폭탄/대용량 응답으로부터 워커 보호.
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
// SSRF 방지 — 웹 핸들러에선 https만 허용. CLI 도구(scripts/ingest.ts 등)는
// 운영자가 직접 실행하며 /tmp/ingest-*.jpg 같은 sandbox 경로를 정상 워크플로로
// 쓰므로 기본 허용. 명시적으로 차단하려면 INGEST_ALLOW_LOCAL_FILES=0.
const ALLOW_LOCAL_FILES = process.env.INGEST_ALLOW_LOCAL_FILES !== '0';

/** 사설/메타데이터/루프백 호스트 차단 (IPv4 기준 휴리스틱). */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  // AWS/GCP/Azure metadata
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  // IPv4 사설/링크로컬/루프백
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 루프백/링크로컬 대략
  if (h === '::1' || h === '[::1]') return true;
  if (h.startsWith('fe80:') || h.startsWith('[fe80:')) return true;
  return false;
}

let cachedClient: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export async function fetchAsBuffer(urlOrPath: string): Promise<Buffer> {
  // URL인지 먼저 시도 — 파싱되면 스킴/호스트 검증, 아니면 로컬 경로로 폴백.
  let parsed: URL | null = null;
  try {
    parsed = new URL(urlOrPath);
  } catch {
    parsed = null;
  }

  if (parsed) {
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`fetchAsBuffer: unsupported scheme ${parsed.protocol}`);
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error(`fetchAsBuffer: blocked host ${parsed.hostname}`);
    }
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`fetch ${urlOrPath} -> ${res.status}`);

    // Content-Length 사전 체크 (서버가 정확하면 빠르게 거절).
    const lenHdr = res.headers.get('content-length');
    if (lenHdr && Number(lenHdr) > MAX_DOWNLOAD_BYTES) {
      throw new Error(`fetchAsBuffer: content-length ${lenHdr} exceeds cap ${MAX_DOWNLOAD_BYTES}`);
    }

    // 스트리밍으로 받으면서 누적 바이트 캡 강제.
    if (!res.body) throw new Error(`fetchAsBuffer: empty body for ${urlOrPath}`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) {
          try { await reader.cancel(); } catch {}
          throw new Error(`fetchAsBuffer: payload exceeds cap ${MAX_DOWNLOAD_BYTES} bytes`);
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  // 로컬 경로 — 기본 차단, env로 opt-in.
  if (!ALLOW_LOCAL_FILES) {
    throw new Error(
      `fetchAsBuffer: local file paths disabled (set INGEST_ALLOW_LOCAL_FILES=1 to allow): ${urlOrPath}`
    );
  }
  return readFileSync(urlOrPath);
}

export type Normalized = {
  buffer: Buffer;
  ext: 'webp';
  width: number;
  height: number;
  hash: string;
  origBytes: number;
};

export async function normalize(input: Buffer): Promise<Normalized> {
  const meta = await sharp(input).metadata();
  // Treat animated GIFs by taking just the first frame (webp keeps it static).
  let pipeline = sharp(input, { animated: false }).rotate();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const buffer = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  const outMeta = await sharp(buffer).metadata();
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  return {
    buffer,
    ext: 'webp',
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
    hash,
    origBytes: input.length,
  };
}

/**
 * Upload normalized buffer to Supabase Storage. Idempotent: if the object
 * already exists, returns its public URL without re-uploading.
 */
export async function upload(n: Normalized): Promise<string> {
  const sb = client();
  const path = `${n.hash}.${n.ext}`;
  // Try upload; if it exists, that's fine.
  const { error } = await sb.storage.from(BUCKET).upload(path, n.buffer, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`upload ${path}: ${error.message}`);
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Convenience: fetch -> normalize -> upload, return final public URL.
 */
export async function pipeImage(
  urlOrPath: string,
): Promise<{ publicUrl: string; normalized: Normalized }> {
  const input = await fetchAsBuffer(urlOrPath);
  const normalized = await normalize(input);
  const publicUrl = await upload(normalized);
  return { publicUrl, normalized };
}
