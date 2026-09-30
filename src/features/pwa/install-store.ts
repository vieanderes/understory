/*
 * Whether Understory is installed, and whether this browser offers an install prompt.
 * Chromium fires `beforeinstallprompt` once, early, so the listener starts with the
 * worker registration in the root layout, long before Settings is opened.
 */

/** Chromium only. Not in the DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  installed: boolean;
  canPrompt: boolean;
  /** iPhone and iPad have no prompt at all: the learner has to use the Share sheet. */
  ios: boolean;
}

const SERVER_STATE: InstallState = { installed: false, canPrompt: false, ios: false };

let state: InstallState = SERVER_STATE;
let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: Partial<InstallState>): void {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function isIos(): boolean {
  // iPadOS reports itself as a Mac; the touch points give it away.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function startInstallWatch(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  set({ installed: isStandalone(), ios: isIos() });
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keeps Chromium's own mini-infobar away. The learner installs from Settings.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ installed: true, canPrompt: false });
  });
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  startInstallWatch();
  return () => listeners.delete(listener);
}

export const getInstallState = (): InstallState => state;
export const getServerInstallState = (): InstallState => SERVER_STATE;

export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  // The event can be used once.
  deferred = null;
  set({ canPrompt: false });
  await event.prompt();
}

/** For tests. */
export function resetInstallStore(): void {
  state = SERVER_STATE;
  deferred = null;
  started = false;
  listeners.clear();
}
