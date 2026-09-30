/* The message API between a page and the worker. Types only: both sides import it. */

export type ClientMessage =
  /** Activate a waiting worker now. Sent by the update flow, never by the worker itself. */
  | { type: 'SKIP_WAITING' }
  /** Cache lesson files and lesson pages. Progress comes back as DOWNLOAD_PROGRESS. */
  | { type: 'DOWNLOAD_COURSE'; id: string; urls: string[] }
  | { type: 'CANCEL_DOWNLOAD'; id: string }
  /** What this page loaded before the worker controlled it: the first visit only. */
  | { type: 'WARM'; urls: string[] }
  | { type: 'GET_BUILD_ID' };

export type WorkerMessage =
  | { type: 'DOWNLOAD_PROGRESS'; id: string; done: number; failed: number; total: number }
  | {
      type: 'DOWNLOAD_DONE';
      id: string;
      done: number;
      failed: number;
      total: number;
      cancelled: boolean;
    }
  | { type: 'WARM_DONE'; stored: number }
  | { type: 'BUILD_ID'; buildId: string };

export function isClientMessage(data: unknown): data is ClientMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as { type?: unknown; id?: unknown; urls?: unknown };
  const urls = (): boolean =>
    Array.isArray(message.urls) && message.urls.every((url) => typeof url === 'string');
  switch (message.type) {
    case 'SKIP_WAITING':
    case 'GET_BUILD_ID':
      return true;
    case 'CANCEL_DOWNLOAD':
      return typeof message.id === 'string';
    case 'DOWNLOAD_COURSE':
      return typeof message.id === 'string' && urls();
    case 'WARM':
      return urls();
    default:
      return false;
  }
}
