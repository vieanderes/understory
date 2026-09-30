export type Window = { requests: number; errors: number };
export type Alert = 'page' | 'ticket' | 'none';

// Below this many requests, one failure is too large a share to mean anything.
const MIN_REQUESTS = 20;

export function alertFor(window: Window): Alert {
  const errorRate = window.errors / window.requests;
  if (errorRate >= 0.05) return 'page';
  return 'none';
}
