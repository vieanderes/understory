const LIMIT = 3;
const WINDOW_MS = 60000;

interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();

// Returns 0 when the request may go ahead, or the whole seconds to wait.
export function check(caller: string, now: number): number {
  // Every request is let through, however many there are.
  return 0;
}
