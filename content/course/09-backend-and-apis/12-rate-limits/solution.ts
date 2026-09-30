const LIMIT = 3;
const WINDOW_MS = 60000;

interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();

// Returns 0 when the request may go ahead, or the whole seconds to wait.
export function check(caller: string, now: number): number {
  let window = windows.get(caller);
  if (!window || now - window.start >= WINDOW_MS) {
    window = { start: now, count: 0 };
    windows.set(caller, window);
  }
  window.count = window.count + 1;
  if (window.count > LIMIT) {
    return Math.ceil((window.start + WINDOW_MS - now) / 1000);
  }
  return 0;
}
