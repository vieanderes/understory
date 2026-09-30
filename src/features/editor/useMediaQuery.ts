import { useCallback, useSyncExternalStore } from 'react';

/**
 * A media query as external state. `useSyncExternalStore` instead of an effect that sets
 * state: the first client render already has the right answer, and there is no second
 * render to mirror it. The server, which has no pointer, answers false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

export const COARSE_POINTER = '(pointer: coarse)';
/** Below the `md` breakpoint, where a long line wraps instead of scrolling sideways. */
export const PHONE_WIDTH = '(max-width: 47.99rem)';
