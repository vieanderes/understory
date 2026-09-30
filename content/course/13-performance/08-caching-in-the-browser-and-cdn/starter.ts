// Picks the Cache-Control header for each path the server answers.
export function cacheControlFor(path: string): string {
  return 'public, max-age=300';
}
