'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { isProtectedPath } from '@/sw/protected';
import {
  applyUpdate,
  getServerWorkerState,
  getWorkerState,
  onRouteChange,
  startWorker,
  subscribeWorker,
} from './worker-client';

/**
 * Registers the service worker and carries the update flow. Mounted once, in the root
 * layout. It renders nothing until a new version waits, and then one quiet line with one
 * action. Inside a lesson or a session it stays silent: the update can wait, the
 * learner's place cannot be given back.
 */
export function RegisterServiceWorker() {
  const pathname = usePathname();
  const { updateReady } = useSyncExternalStore(
    subscribeWorker,
    getWorkerState,
    getServerWorkerState,
  );
  const lastPath = useRef(pathname);

  useEffect(startWorker, []);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    onRouteChange(pathname);
  }, [pathname]);

  if (!updateReady || isProtectedPath(pathname)) return null;
  return (
    <div role="status" className="rule-b bg-surface">
      <div className="frame flex min-h-6 items-center justify-between gap-2 text-sm">
        <p className="text-muted">A new version is ready.</p>
        <Button variant="quiet" size="md" onClick={applyUpdate}>
          Update
        </Button>
      </div>
    </div>
  );
}
