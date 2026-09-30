export type Health = 'ok' | 'down';
export type State = {
  permissions: Health;
  cached: boolean;
  retrieval: Health;
  primary: Health;
  fallback: Health;
};
export type Route = 'refuse' | 'cached-answer' | 'primary' | 'fallback-model' | 'search-results' | 'help-desk';

// Decide how to answer one question, given what is working right now.
export function pickRoute(s: State): Route {
  if (s.permissions === 'down') return 'refuse';
  if (s.cached) return 'cached-answer';
  if (s.retrieval === 'down') return 'help-desk';
  if (s.primary === 'ok') return 'primary';
  if (s.fallback === 'ok') return 'fallback-model';
  return 'search-results';
}
