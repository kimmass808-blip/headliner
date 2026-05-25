/**
 * Spotify Web API client (server-to-server, Client Credentials flow).
 *
 * Caches the access token across calls within a process; refreshes when
 * < 60 s remaining. No user OAuth — we only hit public catalog endpoints
 * (search, artists, top-tracks, albums) that work with app-only auth.
 *
 * Rate limit handling: honors Retry-After on 429, retries once.
 */

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) return cachedToken.value;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set');
  }
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) {
    throw new Error(`spotify token: ${r.status} ${await r.text()}`);
  }
  const j: any = await r.json();
  cachedToken = {
    value: j.access_token,
    expiresAt: now + j.expires_in * 1000,
  };
  return cachedToken.value;
}

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: URL | string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url as any, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function call<T = any>(path: string, params: Record<string, string> = {}, attempt = 0): Promise<T> {
  const token = await getToken();
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let r: Response;
  try {
    r = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    if (attempt < 2) {
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      return call<T>(path, params, attempt + 1);
    }
    throw new Error(`spotify ${path}: ${(e as Error).message}`);
  }

  if (r.status === 429 && attempt < 2) {
    // Cap Retry-After at 30s -- some Spotify responses send absurdly large values.
    const retryAfter = Math.min(Number(r.headers.get('Retry-After') ?? '1'), 30);
    await new Promise((res) => setTimeout(res, (retryAfter + 0.5) * 1000));
    return call<T>(path, params, attempt + 1);
  }
  if (r.status === 401 && attempt < 1) {
    cachedToken = null;
    return call<T>(path, params, attempt + 1);
  }
  if (!r.ok) {
    throw new Error(`spotify ${path}: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as T;
}

// ---------- typed wrappers ----------

export type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: { total: number };
  images: { url: string; width: number; height: number }[];
  external_urls: { spotify: string };
};

export type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  external_ids: { isrc?: string };
  album: {
    id: string;
    name: string;
    release_date: string; // YYYY-MM-DD or YYYY-MM or YYYY
    release_date_precision: 'day' | 'month' | 'year';
    images: { url: string; width: number; height: number }[];
  };
  popularity: number;
  track_number: number;
};

export async function searchArtists(query: string, market = 'KR', limit = 5): Promise<SpotifyArtist[]> {
  const j = await call<{ artists: { items: SpotifyArtist[] } }>('/search', {
    q: query,
    type: 'artist',
    market,
    limit: String(limit),
  });
  return j.artists?.items ?? [];
}

export async function getArtist(id: string): Promise<SpotifyArtist> {
  return call<SpotifyArtist>(`/artists/${encodeURIComponent(id)}`);
}

export async function getArtistTopTracks(id: string, market = 'KR'): Promise<SpotifyTrack[]> {
  const j = await call<{ tracks: SpotifyTrack[] }>(`/artists/${encodeURIComponent(id)}/top-tracks`, {
    market,
  });
  return j.tracks ?? [];
}

export type SpotifyAlbumSummary = {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  release_date: string;
  release_date_precision: 'day' | 'month' | 'year';
  total_tracks: number;
  images: { url: string; width: number; height: number }[];
};

export async function getArtistAlbums(
  id: string,
  opts: { market?: string; limit?: number; include_groups?: string } = {},
): Promise<SpotifyAlbumSummary[]> {
  const { market = 'KR', limit = 20, include_groups = 'album,single' } = opts;
  const j = await call<{ items: SpotifyAlbumSummary[] }>(`/artists/${encodeURIComponent(id)}/albums`, {
    market,
    limit: String(limit),
    include_groups,
  });
  return j.items ?? [];
}

export type SpotifyAlbumTrack = {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  track_number: number;
  disc_number: number;
  external_ids?: { isrc?: string };
};

export type SpotifyAlbumFull = SpotifyAlbumSummary & {
  tracks: { items: SpotifyAlbumTrack[] };
  popularity?: number;
};

export async function getAlbum(id: string, market = 'KR'): Promise<SpotifyAlbumFull> {
  return call<SpotifyAlbumFull>(`/albums/${encodeURIComponent(id)}`, { market });
}

/**
 * Pick the largest image (highest pixel area).
 */
export function pickBestImage(imgs: { url: string; width: number; height: number }[]): string | null {
  if (!imgs || imgs.length === 0) return null;
  let best = imgs[0];
  let bestArea = best.width * best.height;
  for (const i of imgs.slice(1)) {
    const a = i.width * i.height;
    if (a > bestArea) {
      best = i;
      bestArea = a;
    }
  }
  return best.url;
}
