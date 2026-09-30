'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { useCatalog } from '@/features/catalog/useCatalog';
import { courseUrls, estimateCourseBytes, formatMegabytes } from './course-urls';
import {
  cancelDownload,
  getDownloadState,
  getServerDownloadState,
  startDownload,
  subscribeDownload,
} from './download-store';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * The control of the "Download for offline" row in Settings. It fetches every published
 * lesson and its page through the service worker, shows a plain count while it runs, and
 * ends with what the browser reports as stored.
 */
export function DownloadCourse() {
  const { catalog, failed: catalogFailed } = useCatalog();
  const online = useOnlineStatus();
  const download = useSyncExternalStore(
    subscribeDownload,
    getDownloadState,
    getServerDownloadState,
  );

  const lessonCount = catalog ? Object.keys(catalog.lessons).length : 0;
  const running = download.phase === 'running';

  return (
    <>
      <p className="text-sm">
        {catalog ? (
          <>
            <span className="t-figure">{lessonCount}</span>{' '}
            {lessonCount === 1 ? 'lesson' : 'lessons'} · about{' '}
            <span className="t-figure">{formatMegabytes(estimateCourseBytes(catalog))}</span>
          </>
        ) : catalogFailed ? (
          'The course index could not be loaded.'
        ) : (
          <span className="t-figure">··</span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {running ? (
          <Button onClick={cancelDownload}>Cancel</Button>
        ) : (
          <Button
            onClick={() => catalog && startDownload(courseUrls(catalog))}
            disabled={!catalog || !online}
          >
            {download.phase === 'finished' && !download.cancelled
              ? 'Download again'
              : 'Download for offline'}
          </Button>
        )}
        {running ? (
          <p className="t-figure text-sm" aria-hidden>
            {download.done + download.failed} / {download.total}
          </p>
        ) : null}
      </div>

      <p role="status" className="text-muted text-sm">
        {statusText(download, online)}
      </p>
    </>
  );
}

function statusText(download: ReturnType<typeof getDownloadState>, online: boolean): string {
  switch (download.phase) {
    case 'idle':
      return online ? '' : 'Downloading needs a connection.';
    case 'unavailable':
      return 'Offline use is not available in this browser.';
    case 'running':
      return 'Downloading.';
    case 'finished': {
      const stored =
        download.usage === null ? '' : ` ${formatMegabytes(download.usage)} stored on this device.`;
      if (download.cancelled)
        return `Cancelled. ${download.done} of ${download.total} files kept.${stored}`;
      if (download.failed > 0) {
        return `${download.done} of ${download.total} files downloaded, ${download.failed} failed. Try again with a steadier connection.${stored}`;
      }
      return `Downloaded. Every lesson works offline.${stored}`;
    }
  }
}
