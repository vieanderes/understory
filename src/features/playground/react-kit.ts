import { loadPlaygroundReact } from '@/adapters/sandbox/runtime-loader';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import type { Transpiler } from '@/core/ports/code-runner';

/*
 * What a React playground needs before its page can be built: React's text, to inline in
 * the page, and sucrase, to transpile the component. Both load on the first React
 * playground and not before (the lesson route stays light: tests/e2e/bundle-budget.spec.ts),
 * once per page, and the service worker keeps them for offline use after that.
 *
 * An external store for `useSyncExternalStore` (AGENTS.md, law 8): the loading lives out
 * here, and every React playground on the page reads the same state.
 */

export interface ReactKit {
  runtime: string;
  transpiler: Transpiler;
}

export type ReactKitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; kit: ReactKit }
  | { status: 'failed' };

export interface ReactKitStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ReactKitState;
  /** Starts loading, unless it is loading or loaded. After a failure it tries again. */
  load: () => void;
}

export interface ReactKitLoaders {
  runtime: () => Promise<string>;
  transpiler: () => Promise<Transpiler>;
}

const IDLE: ReactKitState = { status: 'idle' };
const LOADING: ReactKitState = { status: 'loading' };
const FAILED: ReactKitState = { status: 'failed' };

export function createReactKitStore(loaders: ReactKitLoaders): ReactKitStore {
  let state: ReactKitState = IDLE;
  const listeners = new Set<() => void>();
  const set = (next: ReactKitState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    load() {
      if (state.status === 'loading' || state.status === 'ready') return;
      set(LOADING);
      Promise.all([loaders.runtime(), loaders.transpiler()]).then(
        ([runtime, transpiler]) => set({ status: 'ready', kit: { runtime, transpiler } }),
        () => set(FAILED),
      );
    },
  };
}

export const reactKit: ReactKitStore = createReactKitStore({
  runtime: loadPlaygroundReact,
  transpiler: loadTranspiler,
});

/** The server has no kit; a React playground renders its loading state there. */
export const serverKitState = (): ReactKitState => IDLE;
