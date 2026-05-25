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
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;

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
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const res = await fetch(urlOrPath, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`fetch ${urlOrPath} -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
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
