/**
 * Where a reload would cost the learner their place: inside a lesson or a practice
 * session. The update flow never reloads these, and the worker does not tidy up old
 * build files while one is open. Shared by the worker and src/features/pwa.
 */
export function isProtectedPath(pathname: string): boolean {
  return /^\/learn\/[^/]+\/[^/]+/.test(pathname) || /^\/practise\/session\/[^/]+/.test(pathname);
}
