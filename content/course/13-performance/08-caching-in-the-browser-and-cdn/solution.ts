// Picks the Cache-Control header for each path the server answers.
export function cacheControlFor(path: string): string {
  if (path.startsWith('/account')) return 'private, no-cache';
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}
