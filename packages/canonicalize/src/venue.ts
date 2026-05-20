import type { Canonicalized } from './types.js';
import venueAliases from './aliases/venues.json' assert { type: 'json' };

interface VenueAlias {
  canonicalKey: string;
  aliases: string[];
}

const aliases = venueAliases as VenueAlias[];

function cleanText(raw: string): string {
  // Trim and collapse internal whitespace
  let text = raw.trim().replace(/\s+/g, ' ');
  // Lowercase (Korean characters are unaffected by toLowerCase)
  text = text.toLowerCase();
  // Strip punctuation/special chars except alphanumeric, Korean, spaces, hyphens
  // Korean unicode range: 가-힯 (syllables), ᄀ-ᇿ (jamo), ㄰-㆏ (compat jamo)
  text = text.replace(/[^a-z0-9가-힯ᄀ-ᇿ㄰-㆏\s\-]/g, '');
  return text;
}

function buildKey(cleaned: string): string {
  return cleaned.trim().replace(/\s+/g, '_');
}

export function canonicalizeVenueText(raw: string): Canonicalized {
  const cleaned = cleanText(raw);

  // Alias lookup: compare cleaned input against cleaned aliases
  for (const entry of aliases) {
    for (const alias of entry.aliases) {
      if (cleanText(alias) === cleaned) {
        return { key: entry.canonicalKey, display: raw };
      }
    }
  }

  // No alias match — generate key from cleaned text
  const key = buildKey(cleaned);
  return { key, display: raw };
}
