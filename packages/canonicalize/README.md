# @mft/canonicalize

String-level canonicalization utilities for venue names, artist names, Instagram URLs, and Instagram handles.

## Usage

```ts
import {
  canonicalizeVenueText,
  canonicalizeArtistName,
  canonicalizeInstagramUrl,
  canonicalizeInstagramHandle,
} from '@mft/canonicalize';
```

### `canonicalizeVenueText(raw: string): Canonicalized`

Normalizes a venue name to a stable key using alias lookup, with the original preserved as `display`.

```ts
canonicalizeVenueText('롤링홀')
// → { key: 'rolling_hall', display: '롤링홀' }

canonicalizeVenueText('Rolling Hall')
// → { key: 'rolling_hall', display: 'Rolling Hall' }

canonicalizeVenueText('롤링 홀  ')
// → { key: 'rolling_hall', display: '롤링 홀  ' }

canonicalizeVenueText('새로운 공연장')
// → { key: '새로운_공연장', display: '새로운 공연장' }
```

### `canonicalizeArtistName(raw: string): Canonicalized`

Normalizes an artist name. No external alias lookup — DB-level dedup uses `Artist.aliases[]`.

```ts
canonicalizeArtistName('잔나비')
// → { key: '잔나비', display: '잔나비' }

canonicalizeArtistName('JANNABI')
// → { key: 'jannabi', display: 'JANNABI' }

canonicalizeArtistName('  잔나비  ')
// → { key: '잔나비', display: '  잔나비  ' }
```

### `canonicalizeInstagramUrl(url: string): string`

Normalizes an Instagram post, reel, or profile URL to canonical form. Throws if the URL is not a recognized Instagram URL.

```ts
canonicalizeInstagramUrl('https://instagram.com/p/Abc123?igshid=xyz')
// → 'https://www.instagram.com/p/Abc123/'

canonicalizeInstagramUrl('http://www.instagram.com/p/Abc123/')
// → 'https://www.instagram.com/p/Abc123/'

canonicalizeInstagramUrl('https://www.instagram.com/reel/XyZ789/?igshid=abc')
// → 'https://www.instagram.com/reel/XyZ789/'

canonicalizeInstagramUrl('https://www.instagram.com/jannabi.official/')
// → 'https://www.instagram.com/jannabi.official/'
```

### `canonicalizeInstagramHandle(raw: string): string | null`

Strips leading `@`, validates the handle, and returns it lowercased. Returns `null` for invalid input.

```ts
canonicalizeInstagramHandle('@jannabi.official') // → 'jannabi.official'
canonicalizeInstagramHandle('JANNABI')           // → 'jannabi'
canonicalizeInstagramHandle('#concert')          // → null
canonicalizeInstagramHandle('user@example.com')  // → null
canonicalizeInstagramHandle('trailing.')         // → null
canonicalizeInstagramHandle('')                  // → null
```

## Extending the Venue Alias JSON

Add entries to `src/aliases/venues.json`:

```json
[
  {
    "canonicalKey": "my_venue",
    "aliases": ["My Venue", "마이베뉴", "myVenue"]
  }
]
```

Rules:
- `canonicalKey` must be unique across all entries, snake_case, ASCII only.
- `aliases` should include all known spellings: Korean, English, common abbreviations, spacing variants.
- Matching is case-insensitive and whitespace-normalized — you do not need to list every case variant, but do list spacing variants (e.g. `"롤링홀"` and `"롤링 홀"`).

## Running Tests

```bash
pnpm --filter @mft/canonicalize test
```
