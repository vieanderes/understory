import type { RunRuntime } from '@/core/ports/code-runner';

export const REACT_RUNTIME_URL = '/sandbox/react-runtime.v1.js';

/** React and react-dom for React playgrounds (docs/SANDBOX.md, "React in the playground"). */
export const REACT_PLAYGROUND_URL = '/sandbox/react-playground.v1.js';

const loading = new Map<string, Promise<string>>();

/**
 * Loads the text of a static sandbox file from the app origin, once per page. The frames
 * cannot fetch it: the runner's origin is opaque and its CSP is `default-src 'none'`, and
 * the playground's page may not fetch anything either. The parent can, and the service
 * worker keeps the file for offline use once it has been fetched.
 */
function loadText(url: string, what: string): Promise<string> {
  let pending = loading.get(url);
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`The ${what} answered ${response.status}`);
      return response.text();
    });
    // A failed load (offline before the first run, a deploy in progress) must be retryable.
    pending.catch(() => loading.delete(url));
    loading.set(url, pending);
  }
  return pending;
}

/** The runtime a run needs, for the runner to send into its worker. */
export function loadRuntime(name: RunRuntime): Promise<string> {
  return loadText(REACT_RUNTIME_URL, `${name} runtime`);
}

/** The React a playground page inlines. */
export function loadPlaygroundReact(): Promise<string> {
  return loadText(REACT_PLAYGROUND_URL, 'React playground runtime');
}
