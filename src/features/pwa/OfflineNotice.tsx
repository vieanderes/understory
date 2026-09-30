'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from './useOnlineStatus';

/** One hairline line in the app shell while there is no network. It states a fact and reassures. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="rule-b bg-bg">
      <p className="frame text-muted flex min-h-5 items-center gap-1 text-sm">
        <WifiOff aria-hidden size={16} strokeWidth={2} />
        Offline. Progress is saved on this device.
      </p>
    </div>
  );
}
