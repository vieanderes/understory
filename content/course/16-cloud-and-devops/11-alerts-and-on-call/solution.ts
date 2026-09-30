export type Window = { requests: number; errors: number };
export type Alert = 'page' | 'ticket' | 'none';

// Below this many requests, one failure is too large a share to mean anything.
const MIN_REQUESTS = 20;

export function alertFor(window: Window): Alert {
  if (window.requests < MIN_REQUESTS) return 'none';
  const errorRate = window.errors / window.requests;
  if (errorRate >= 0.05) return 'page';
  if (errorRate >= 0.01) return 'ticket';
  return 'none';
}
