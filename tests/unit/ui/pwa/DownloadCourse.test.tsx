import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFile } from '@/core/practice';
import type { ClientMessage, WorkerMessage } from '@/sw/messages';

/*
 * "Download for offline" in Settings: the count while it runs, cancelling, and what is
 * said at the end. The worker itself is mocked; what it does with the list is covered in
 * tests/unit/adapters/sw.
 */

const sent: ClientMessage[] = [];
let deliver: ((message: WorkerMessage) => void) | null = null;
let reachable = true;

vi.mock('@/features/pwa/worker-client', () => ({
  postToWorker: (message: ClientMessage) => {
    if (!reachable) return false;
    sent.push(message);
    return true;
  },
  onWorkerMessage: (handler: (message: WorkerMessage) => void) => {
    deliver = handler;
    return () => {
      deliver = null;
    };
  },
}));

let catalog: CatalogFile | null = null;
vi.mock('@/features/catalog/useCatalog', () => ({
  useCatalog: () => ({ catalog, failed: catalog === null }),
}));

const { DownloadCourse } = await import('@/features/pwa/DownloadCourse');
const { resetDownloadStore } = await import('@/features/pwa/download-store');

function lesson(slug: string, minutes: number, solutions = true) {
  return {
    title: slug,
    moduleId: 'm1',
    moduleSlug: 'javascript',
    slug,
    level: 'essential' as const,
    minutes,
    concepts: [],
    file: `lessons/js.${slug}.ab12.json`,
    ...(solutions ? { solutionsFile: `solutions/js.${slug}.ab12.json` } : {}),
  };
}

const CATALOG = {
  schema: 1,
  contentRev: 'r1',
  modules: [],
  concepts: [],
  lessons: { a: lesson('closures', 10), b: lesson('promises', 5, false) },
} as unknown as CatalogFile;

function push(message: WorkerMessage): void {
  act(() => deliver?.(message));
}

beforeEach(() => {
  sent.length = 0;
  deliver = null;
  reachable = true;
  catalog = CATALOG;
  resetDownloadStore();
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  resetDownloadStore();
});

describe('DownloadCourse', () => {
  it('says how many lessons there are and roughly how much that is', () => {
    const { container } = render(<DownloadCourse />);
    // 15 minutes of lesson at 6800 bytes a minute, floored at one decimal.
    expect(container.querySelector('p')).toHaveTextContent('2 lessons \u00b7 about 0.1 MB');
  });

  it('sends every lesson file, solutions file and lesson page to the worker', async () => {
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));

    expect(sent).toHaveLength(1);
    const message = sent[0];
    expect(message?.type).toBe('DOWNLOAD_COURSE');
    expect(message?.type === 'DOWNLOAD_COURSE' ? message.urls : []).toEqual([
      '/content/v1/lessons/js.closures.ab12.json',
      '/content/v1/solutions/js.closures.ab12.json',
      '/learn/javascript/closures',
      '/content/v1/lessons/js.promises.ab12.json',
      '/learn/javascript/promises',
    ]);
  });

  it('counts progress as the worker reports it', async () => {
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Downloading.');

    const id = sent[0]?.type === 'DOWNLOAD_COURSE' ? sent[0].id : '';
    push({ type: 'DOWNLOAD_PROGRESS', id, done: 3, failed: 1, total: 5 });
    expect(screen.getByText('4 / 5')).toBeInTheDocument();
  });

  it('ignores a report from a download that is not this one', async () => {
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    push({ type: 'DOWNLOAD_PROGRESS', id: 'somebody-else', done: 4, failed: 0, total: 5 });
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
  });

  it('offers Cancel while it runs, and keeps what was fetched', async () => {
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    const id = sent[0]?.type === 'DOWNLOAD_COURSE' ? sent[0].id : '';

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(sent[1]).toEqual({ type: 'CANCEL_DOWNLOAD', id });

    await act(async () => {
      deliver?.({ type: 'DOWNLOAD_DONE', id, done: 2, failed: 0, total: 5, cancelled: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled. 2 of 5 files kept.');
    expect(screen.getByRole('button', { name: 'Download for offline' })).toBeEnabled();
  });

  it('reports what the browser holds when it finishes', async () => {
    Object.defineProperty(window.navigator, 'storage', {
      value: { estimate: async () => ({ usage: 3 * 1024 * 1024 }) },
      configurable: true,
    });
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    const id = sent[0]?.type === 'DOWNLOAD_COURSE' ? sent[0].id : '';

    await act(async () => {
      deliver?.({ type: 'DOWNLOAD_DONE', id, done: 5, failed: 0, total: 5, cancelled: false });
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Downloaded. Every lesson works offline. 3.0 MB stored on this device.',
    );
    expect(screen.getByRole('button', { name: 'Download again' })).toBeInTheDocument();
  });

  it('names the files that failed and suggests a steadier connection', async () => {
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    const id = sent[0]?.type === 'DOWNLOAD_COURSE' ? sent[0].id : '';
    await act(async () => {
      deliver?.({ type: 'DOWNLOAD_DONE', id, done: 3, failed: 2, total: 5, cancelled: false });
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 of 5 files downloaded, 2 failed. Try again with a steadier connection.',
    );
  });

  it('cannot start with no connection, and says why', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    render(<DownloadCourse />);
    expect(screen.getByRole('button', { name: 'Download for offline' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Downloading needs a connection.');
  });

  it('says so in a browser with no service worker', async () => {
    reachable = false;
    render(<DownloadCourse />);
    await userEvent.click(screen.getByRole('button', { name: 'Download for offline' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline use is not available in this browser.',
    );
  });

  it('waits for the course index before it offers anything', () => {
    catalog = null;
    render(<DownloadCourse />);
    expect(screen.getByRole('button', { name: 'Download for offline' })).toBeDisabled();
    expect(screen.getByText('The course index could not be loaded.')).toBeInTheDocument();
  });
});
