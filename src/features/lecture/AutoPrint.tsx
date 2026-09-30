'use client';

import { useEffect } from 'react';

/**
 * Opens the print dialog when the page was opened with `?print=1`: the download button's
 * fallback where no PDF was built. It waits for the fonts, so the first print is not set
 * in a fallback face.
 */
export function AutoPrint() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') !== '1') return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
