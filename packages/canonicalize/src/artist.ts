import type { Canonicalized } from './types.js';

function cleanText(raw: string): string {
  // Trim and collapse internal whitespace
  let text = raw.trim().replace(/\s+/g, ' ');
  // Lowercase non-Korean parts (Korean characters are unaffected by toLowerCase)
  text = text.toLowerCase();
  // Strip punctuation/special chars except alphanumeric, Korean, spaces, hyphens
  text = text.replace(/[^a-z0-9가-힯ᄀ-ᇿ㄰-㆏\s\-]/g, '');
  return text;
}

function buildKey(cleaned: string): string {
  return cleaned.trim().replace(/\s+/g, '_');
}

export function canonicalizeArtistName(raw: string): Canonicalized {
  // No external alias lookup — string-level normalization only.
  // Artist.aliases[] in DB handles dedup across display names.
  const cleaned = cleanText(raw);
  const key = buildKey(cleaned);
  return { key, display: raw };
}
