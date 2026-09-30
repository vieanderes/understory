'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { PreviewStore } from './preview-store';

interface PreviewFrameProps {
  /** A whole document from `buildPlaygroundDocument`. */
  doc: string;
  title: string;
  /** Receives the probe's reports. Absent for a preview nobody checks, such as a solution. */
  store?: PreviewStore;
  className?: string;
}

/**
 * The rendered page. `srcdoc` needs no network, so it works offline, and `sandbox` with
 * only `allow-scripts` gives it an opaque origin: learner code cannot reach the app, its
 * storage or its cookies (docs/SANDBOX.md, "Playground"). The page's own policy, inside
 * the document, blocks every request and every script the step does not allow.
 *
 * The white ground is the browser's default and is kept on purpose, in both themes: this
 * is a web page as a browser draws it, not a part of the app.
 */
export function PreviewFrame({ doc, title, store, className }: PreviewFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => store?.attach(() => frame.current?.contentWindow ?? null), [store]);

  return (
    <iframe
      ref={frame}
      title={title}
      sandbox="allow-scripts"
      srcDoc={doc}
      className={cn('border-border rounded-panel block w-full border', className)}
    />
  );
}
