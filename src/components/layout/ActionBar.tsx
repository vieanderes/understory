'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The bar of actions pinned to the foot of a focus screen (Check, Continue, Begin).
 *
 * It is fixed, so the page has to leave room for it, and its height is not constant: it
 * wraps to two rows on a phone and grows by the home-indicator inset. A guessed padding
 * hid the last answer under the bar, so a spacer in the flow copies the bar's real height
 * and the end of the page always scrolls clear of it. The height is written to the DOM,
 * not to state: it is layout, and a render per resize would buy nothing.
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const bar = useRef<HTMLElement>(null);
  const spacer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = bar.current;
    const gap = spacer.current;
    if (!el || !gap) return;
    const sync = () => {
      gap.style.height = `${el.offsetHeight}px`;
    };
    sync();
    // Every supported browser has it; a test DOM may not, and the first measure still holds.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={spacer} aria-hidden className="shrink-0" />
      <footer ref={bar} className="rule-t bg-bg pb-safe fixed inset-x-0 bottom-0 z-20">
        <div className={cn('frame flex min-h-9 items-center gap-1 py-1', className)}>
          {children}
        </div>
      </footer>
    </>
  );
}
