import type { WorkerMessage } from '@/sw/messages';
import { onWorkerMessage, postToWorker } from './worker-client';

/*
 * The state of one course download. An external store, because progress arrives as
 * messages from the worker, and because a download should survive the learner leaving
 * Settings and coming back.
 */

export type DownloadState =
  | { phase: 'idle' }
  | { phase: 'unavailable' }
  | { phase: 'running'; done: number; failed: number; total: number }
  | {
      phase: 'finished';
      done: number;
      failed: number;
      total: number;
      cancelled: boolean;
      /** Bytes this site holds on the device, from `navigator.storage.estimate()`. */
      usage: number | null;
    };

const IDLE: DownloadState = { phase: 'idle' };

let state: DownloadState = IDLE;
let currentId: string | null = null;
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: DownloadState): void {
  state = next;
  listeners.forEach((notify) => notify());
}

export function subscribeDownload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getDownloadState = (): DownloadState => state;
export const getServerDownloadState = (): DownloadState => IDLE;

async function storageUsage(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.usage ?? null;
  } catch {
    return null;
  }
}

function receive(message: WorkerMessage): void {
  if (message.type === 'DOWNLOAD_PROGRESS' && message.id === currentId) {
    set({ phase: 'running', done: message.done, failed: message.failed, total: message.total });
  }
  if (message.type === 'DOWNLOAD_DONE' && message.id === currentId) {
    const { done, failed, total, cancelled } = message;
    currentId = null;
    stopListening?.();
    stopListening = null;
    void storageUsage().then((usage) =>
      set({ phase: 'finished', done, failed, total, cancelled, usage }),
    );
  }
}

export function startDownload(urls: string[]): void {
  if (currentId !== null) return;
  const id = `download-${Date.now()}`;
  stopListening = onWorkerMessage(receive);
  if (!postToWorker({ type: 'DOWNLOAD_COURSE', id, urls })) {
    stopListening();
    stopListening = null;
    set({ phase: 'unavailable' });
    return;
  }
  currentId = id;
  set({ phase: 'running', done: 0, failed: 0, total: urls.length });
}

export function cancelDownload(): void {
  if (currentId !== null) postToWorker({ type: 'CANCEL_DOWNLOAD', id: currentId });
}

/** For tests. */
export function resetDownloadStore(): void {
  stopListening?.();
  stopListening = null;
  currentId = null;
  state = IDLE;
  listeners.clear();
}
