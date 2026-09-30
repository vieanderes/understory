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
  return 'primary';
}
