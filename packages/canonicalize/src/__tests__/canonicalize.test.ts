import { describe, it, expect } from 'vitest';
import { canonicalizeVenueText } from '../venue.js';
import { canonicalizeArtistName } from '../artist.js';
import { canonicalizeInstagramUrl } from '../instagram-url.js';
import { canonicalizeInstagramHandle } from '../instagram-handle.js';

// ─── Venue ────────────────────────────────────────────────────────────────────

describe('canonicalizeVenueText', () => {
  it('resolves 롤링홀 to rolling_hall via alias', () => {
    expect(canonicalizeVenueText('롤링홀').key).toBe('rolling_hall');
  });

  it('resolves Rolling Hall to rolling_hall via alias (case-insensitive)', () => {
    expect(canonicalizeVenueText('Rolling Hall').key).toBe('rolling_hall');
  });

  it('resolves 롤링 홀   (trailing spaces) to rolling_hall via alias', () => {
    expect(canonicalizeVenueText('롤링 홀  ').key).toBe('rolling_hall');
  });

  it('preserves original raw string as display', () => {
    expect(canonicalizeVenueText('롤링 홀  ').display).toBe('롤링 홀  ');
  });

  it('generates key for unknown venue', () => {
    const result = canonicalizeVenueText('My New Venue');
    expect(result.key).toBe('my_new_venue');
    expect(result.display).toBe('My New Venue');
  });

  it('strips punctuation from generated key', () => {
    const result = canonicalizeVenueText('Venue! @Seoul#2024');
    expect(result.key).toBe('venue_seoul2024');
  });

  it('preserves Korean characters in generated key', () => {
    const result = canonicalizeVenueText('새 공연장');
    expect(result.key).toBe('새_공연장');
  });

  it('resolves 벨로주 via alias', () => {
    expect(canonicalizeVenueText('벨로주').key).toBe('velozoo');
  });
});

// ─── Artist ───────────────────────────────────────────────────────────────────

describe('canonicalizeArtistName', () => {
  it('preserves Korean artist name', () => {
    expect(canonicalizeArtistName('잔나비').key).toBe('잔나비');
  });

  it('lowercases latin artist name', () => {
    expect(canonicalizeArtistName('JANNABI').key).toBe('jannabi');
  });

  it('preserves display as original', () => {
    expect(canonicalizeArtistName('JANNABI').display).toBe('JANNABI');
  });

  it('trims and compresses whitespace in key', () => {
    expect(canonicalizeArtistName('  잔나비  ').key).toBe('잔나비');
    expect(canonicalizeArtistName('  잔나비  ').display).toBe('  잔나비  ');
  });

  it('handles mixed Korean+latin artist name', () => {
    const result = canonicalizeArtistName('SE SO NEON');
    expect(result.key).toBe('se_so_neon');
  });

  it('strips punctuation from artist key', () => {
    const result = canonicalizeArtistName('Artist!Name');
    expect(result.key).toBe('artistname');
  });
});

// ─── Instagram URL ────────────────────────────────────────────────────────────

describe('canonicalizeInstagramUrl', () => {
  it('strips query params from post URL', () => {
    expect(canonicalizeInstagramUrl('https://instagram.com/p/Abc123?igshid=xyz'))
      .toBe('https://www.instagram.com/p/Abc123/');
  });

  it('upgrades http to https', () => {
    expect(canonicalizeInstagramUrl('http://www.instagram.com/p/Abc123/'))
      .toBe('https://www.instagram.com/p/Abc123/');
  });

  it('adds www to canonical host', () => {
    expect(canonicalizeInstagramUrl('https://instagram.com/p/Abc123/'))
      .toBe('https://www.instagram.com/p/Abc123/');
  });

  it('normalizes reel URL', () => {
    expect(canonicalizeInstagramUrl('https://www.instagram.com/reel/XyZ789/?igshid=abc'))
      .toBe('https://www.instagram.com/reel/XyZ789/');
  });

  it('normalizes profile URL', () => {
    expect(canonicalizeInstagramUrl('https://www.instagram.com/jannabi.official/'))
      .toBe('https://www.instagram.com/jannabi.official/');
  });

  it('throws on non-Instagram URL', () => {
    expect(() => canonicalizeInstagramUrl('https://twitter.com/user')).toThrow();
  });

  it('throws on completely invalid input', () => {
    expect(() => canonicalizeInstagramUrl('not-a-url')).toThrow();
  });
});

// ─── Instagram Handle ─────────────────────────────────────────────────────────

describe('canonicalizeInstagramHandle', () => {
  it('strips leading @ and lowercases', () => {
    expect(canonicalizeInstagramHandle('@jannabi.official')).toBe('jannabi.official');
  });

  it('lowercases uppercase handle', () => {
    expect(canonicalizeInstagramHandle('JANNABI')).toBe('jannabi');
  });

  it('accepts handles with underscores and dots', () => {
    expect(canonicalizeInstagramHandle('user_name.123')).toBe('user_name.123');
  });

  it('rejects hashtag', () => {
    expect(canonicalizeInstagramHandle('#concert')).toBeNull();
  });

  it('rejects email pattern', () => {
    expect(canonicalizeInstagramHandle('user@example.com')).toBeNull();
  });

  it('rejects trailing dot', () => {
    expect(canonicalizeInstagramHandle('trailing.')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(canonicalizeInstagramHandle('')).toBeNull();
  });

  it('rejects handle longer than 30 chars', () => {
    expect(canonicalizeInstagramHandle('a'.repeat(31))).toBeNull();
  });

  it('accepts handle of exactly 30 chars', () => {
    const handle = 'a'.repeat(30);
    expect(canonicalizeInstagramHandle(handle)).toBe(handle);
  });

  it('rejects handle with invalid characters', () => {
    expect(canonicalizeInstagramHandle('한글handle')).toBeNull();
  });
});
