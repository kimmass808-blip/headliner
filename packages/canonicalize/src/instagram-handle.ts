const HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

export function canonicalizeInstagramHandle(raw: string): string | null {
  if (!raw || raw.trim().length === 0) return null;

  let handle = raw.trim();

  // Reject hashtags
  if (handle.startsWith('#')) return null;

  // Strip leading @
  if (handle.startsWith('@')) {
    handle = handle.slice(1);
  }

  // Reject if contains @ (email pattern like user@example.com)
  if (handle.includes('@')) return null;

  // Reject trailing dot (invalid IG handle pattern)
  if (handle.endsWith('.')) return null;

  // Reject empty after stripping
  if (handle.length === 0) return null;

  // Validate length and character set
  if (!HANDLE_REGEX.test(handle)) return null;

  // Lowercase and return
  return handle.toLowerCase();
}
