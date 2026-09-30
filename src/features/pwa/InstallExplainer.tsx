'use client';

import { Share, SquarePlus } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import {
  getInstallState,
  getServerInstallState,
  promptInstall,
  subscribeInstall,
} from './install-store';

/**
 * The control of the "Install" row in Settings. Safari on iPhone and iPad has no install
 * prompt, so the two steps are written out. Chromium has one, so there is a button.
 */
export function InstallExplainer() {
  const { installed, canPrompt, ios } = useSyncExternalStore(
    subscribeInstall,
    getInstallState,
    getServerInstallState,
  );

  if (installed) {
    return <p className="text-sm">Installed. The browser keeps the storage of an installed app.</p>;
  }
  if (canPrompt) {
    return <Button onClick={() => void promptInstall()}>Install Understory</Button>;
  }
  if (ios) {
    return (
      <ol className="flex flex-col gap-1 text-sm">
        <li className="flex items-center gap-1">
          <span className="t-figure text-muted">1</span>
          <Share aria-hidden size={16} strokeWidth={2} />
          In Safari, press Share.
        </li>
        <li className="flex items-center gap-1">
          <span className="t-figure text-muted">2</span>
          <SquarePlus aria-hidden size={16} strokeWidth={2} />
          Choose Add to Home Screen.
        </li>
      </ol>
    );
  }
  return (
    <p className="text-muted text-sm">
      Use the install or Add to Home Screen command in your browser&apos;s menu.
    </p>
  );
}
