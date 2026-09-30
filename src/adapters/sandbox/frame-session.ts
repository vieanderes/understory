import { LIMITS } from '@/core/running/limits';
import {
  PROTOCOL_VERSION,
  parseFrameMessage,
  type FrameMessage,
  type InitMessage,
  type PythonAssetsMessage,
  type PythonPackagesMessage,
  type RunMessage,
} from '@/core/running/protocol';

/**
 * One sandbox iframe and the MessagePort that talks to it.
 *
 * The frame's response carries the `sandbox allow-scripts` CSP directive, so its origin is
 * opaque. The iframe has no `sandbox` attribute on purpose: browsers never hand the
 * navigation of a frame with one to the service worker, so the runner could not load
 * offline (docs/SANDBOX.md, "Offline"). What the attribute guarded against, a response that
 * lost its header, is checked after `load` instead: a frame whose document the page can
 * read is not isolated, and it is removed before it receives anything.
 *
 * An opaque origin cannot be named as a `targetOrigin`, which is why `init` goes out with '*'.
 * That is safe here: `init` holds no secret, and it is posted to the window object of
 * the frame this module created, not broadcast.
 *
 * Nothing is ever read from `window.onmessage`. The port is handed over after the
 * frame's `load` event, and the reply arrives on the port, so no listener exists that a
 * foreign window could post to and there is no `event.source` to get wrong.
 */
export interface FrameSession {
  send(message: RunMessage | PythonAssetsMessage | PythonPackagesMessage): void;
  /** One listener at a time: the active run. Messages are already validated. */
  listen(listener: ((message: FrameMessage) => void) | null): void;
  /** The second termination layer: removing the frame kills its worker with it. */
  destroy(): void;
}

export interface FrameSessionOptions {
  url: string;
  container: HTMLElement;
  handshakeTimeoutMs?: number;
}

let sessionCounter = 0;

export function openFrameSession(options: FrameSessionOptions): {
  ready: Promise<FrameSession>;
  /** Abandons the handshake or the session, whichever is current. Idempotent. */
  destroy(): void;
} {
  const initId = `init-${Date.now().toString(36)}-${(sessionCounter += 1)}`;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Code sandbox';
  iframe.tabIndex = -1;
  iframe.hidden = true;

  const channel = new MessageChannel();
  const port = channel.port1;
  let listener: ((message: FrameMessage) => void) | null = null;
  let destroyed = false;
  let handshakeTimer: number | undefined;
  let rejectReady: ((reason: Error) => void) | null = null;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    window.clearTimeout(handshakeTimer);
    iframe.removeEventListener('load', onLoad);
    port.onmessage = null;
    port.close();
    // Closing an untransferred port2 is harmless; after the transfer it is neutered.
    channel.port2.close();
    listener = null;
    iframe.remove();
    rejectReady?.(new Error('The sandbox was closed before it was ready.'));
    rejectReady = null;
  };

  const session: FrameSession = {
    send(message) {
      if (!destroyed) port.postMessage(message);
    },
    listen(next) {
      listener = next;
    },
    destroy,
  };

  function onLoad(): void {
    const target = iframe.contentWindow;
    if (!target || destroyed) return;
    const readable = readableDocument(iframe);
    // The initial empty document, before the runner has arrived. Wait for the real one.
    if (readable === 'about:blank') return;
    iframe.removeEventListener('load', onLoad);
    if (readable !== null) {
      // Same-origin with the app: the sandbox header is missing. Fail closed.
      rejectReady?.(new Error('The sandbox is not isolated, so it was not started.'));
      rejectReady = null;
      destroy();
      return;
    }
    const init: InitMessage = { v: PROTOCOL_VERSION, type: 'init', runId: initId };
    target.postMessage(init, '*', [channel.port2]);
  }

  const ready = new Promise<FrameSession>((resolve, reject) => {
    rejectReady = reject;
    port.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseFrameMessage(event.data);
      if (!message) return;
      if (message.type === 'ready') {
        if (message.runId !== initId || rejectReady === null) return;
        window.clearTimeout(handshakeTimer);
        rejectReady = null;
        resolve(session);
        return;
      }
      listener?.(message);
    };
    handshakeTimer = window.setTimeout(() => {
      const failure = new Error('The sandbox did not answer. Check the connection and try again.');
      rejectReady = null;
      destroy();
      reject(failure);
    }, options.handshakeTimeoutMs ?? LIMITS.handshakeTimeoutMs);
  });

  // dispose() during the handshake rejects `ready` with nobody waiting for it.
  ready.catch(() => undefined);

  iframe.addEventListener('load', onLoad);
  iframe.src = options.url;
  options.container.append(iframe);

  return { ready, destroy };
}

/**
 * The URL of the frame's document when the page can read it, which means it shares the
 * app's origin, or null when it cannot: an opaque origin, as the runner must have, or a
 * browser error page.
 */
function readableDocument(iframe: HTMLIFrameElement): string | null {
  try {
    return iframe.contentDocument?.URL ?? null;
  } catch {
    return null;
  }
}
