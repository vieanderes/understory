import { parsePlaygroundMessage, type ProbeReport } from '@/core/playground';

/*
 * The latest report from a playground's preview frame, as an external store for
 * `useSyncExternalStore` (AGENTS.md, law 8). The frame is the source of truth for what
 * the page looks like; React only reads it.
 *
 * A report counts only when it comes from this store's frame and carries the nonce of the
 * document the frame holds now. An older document can still have a report in flight
 * after the next one was sent, and it must not tick a check the learner has since broken.
 */

export interface PreviewStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ProbeReport | null;
  /** The nonce of the document just given to the frame. */
  expect: (nonce: string) => void;
  /** Listens for the frame's messages until the returned function is called. */
  attach: (frame: () => Window | null) => () => void;
}

export function createPreviewStore(initialNonce: string): PreviewStore {
  let report: ProbeReport | null = null;
  let nonce = initialNonce;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => report,
    expect(next) {
      nonce = next;
    },
    attach(frame) {
      const onMessage = (event: MessageEvent) => {
        const source = frame();
        if (source === null || event.source !== source) return;
        const message = parsePlaygroundMessage(event.data);
        if (!message || message.nonce !== nonce) return;
        report = message.report;
        for (const listener of listeners) listener();
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    },
  };
}

/** A nonce per document, letters and digits only, as the page's policy needs. */
let serial = 0;
export function nextNonce(): string {
  serial += 1;
  return `p${serial.toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}
