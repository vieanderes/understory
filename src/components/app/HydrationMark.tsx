'use client';

import { useEffect } from 'react';

/**
 * Marks the document once React has taken over the page.
 *
 * Between first paint and hydration a control is drawn but not yet wired. A person can
 * click in that window and see nothing happen, and a test can act in it and measure a
 * layout that is still settling. The flag gives both a precise moment to wait for, and
 * one place to look when hydration stalls.
 */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);
  return null;
}
