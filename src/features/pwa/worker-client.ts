import type { ClientMessage, WorkerMessage } from '@/sw/messages';
import { isProtectedPath } from '@/sw/protected';

/*
 * The page's side of the service worker: registration, the update flow and messages.
 * It is an external store (read through useSyncExternalStore), because the worker's
 * life cycle happens outside React.
 *
 * The update rule: a new worker waits. It takes over when the learner presses Update,
 * or on the next move between places of the app. A page inside a lesson or a practice
 * session is never reloaded; it reloads once the learner has left it.
 */

export interface WorkerState {
  /** A worker controls this page, so what it loads is being kept for offline use. */
  controlled: boolean;
  /** A new version is installed and waiting for a good moment. */
  updateReady: boolean;
}

const SERVER_STATE: WorkerState = { controlled: false, updateReady: false };

let state: WorkerState = SERVER_STATE;
let started = false;
let registration: ServiceWorkerRegistration | null = null;
let reloadWhenFree = false;
let reloading = false;
const listeners = new Set<() => void>();

function set(next: Partial<WorkerState>): void {
  state = { ...state, ...next };
  // Tests and the e2e suite wait on this instead of guessing at timing.
  document.documentElement.dataset.worker = state.updateReady
    ? 'update-ready'
    : state.controlled
      ? 'controlled'
      : 'registered';
  listeners.forEach((notify) => notify());
}

export function subscribeWorker(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getWorkerState = (): WorkerState => state;
export const getServerWorkerState = (): WorkerState => SERVER_STATE;

export function workerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** Posts to the worker in control, or to the active one on a first visit. */
export function postToWorker(message: ClientMessage): boolean {
  if (!workerSupported()) return false;
  const target = navigator.serviceWorker.controller ?? registration?.active ?? null;
  target?.postMessage(message);
  return target !== null;
}

export function onWorkerMessage(handler: (message: WorkerMessage) => void): () => void {
  if (!workerSupported()) return () => undefined;
  const listener = (event: MessageEvent): void => handler(event.data as WorkerMessage);
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

function reload(): void {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

function watchInstalling(worker: ServiceWorker | null): void {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    // "installed" with a controller present means it waits behind the current worker.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      set({ updateReady: true });
    }
  });
}

/** Files this page fetched before a worker could see them. Only needed on the first visit. */
function loadedUrls(): string[] {
  const resources = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(window.location.origin));
  return [window.location.pathname, ...resources];
}

async function register(): Promise<void> {
  const hadController = navigator.serviceWorker.controller !== null;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    set({ controlled: true, updateReady: false });
    if (!hadController) {
      // The first worker claimed the page. Nothing changed for the learner: no reload.
      postToWorker({ type: 'WARM', urls: loadedUrls() });
      return;
    }
    if (isProtectedPath(window.location.pathname)) reloadWhenFree = true;
    else reload();
  });

  registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  set({ controlled: hadController, updateReady: registration.waiting !== null && hadController });
  watchInstalling(registration.installing);
  registration.addEventListener('updatefound', () =>
    watchInstalling(registration?.installing ?? null),
  );
}

/** Idempotent. Production only: a worker in development serves stale code and confuses everyone. */
export function startWorker(): void {
  if (started || process.env.NODE_ENV !== 'production' || !workerSupported()) return;
  started = true;
  const begin = (): void => void register().catch(() => undefined);
  // After load, so registration never competes with the first render for the network.
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
}

/** The learner pressed Update, or moved between places. */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) return;
  const message: ClientMessage = { type: 'SKIP_WAITING' };
  waiting.postMessage(message);
}

/** Called with the new path after every client-side navigation. */
export function onRouteChange(pathname: string): void {
  if (isProtectedPath(pathname)) return;
  if (reloadWhenFree) reload();
  else if (state.updateReady) applyUpdate();
}

/** For tests. */
export function resetWorkerClient(): void {
  state = SERVER_STATE;
  started = false;
  registration = null;
  reloadWhenFree = false;
  reloading = false;
  listeners.clear();
}
