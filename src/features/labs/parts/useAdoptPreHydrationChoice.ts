'use client';

import { useRef, type RefCallback } from 'react';

/**
 * A control is drawn by the server and only becomes React's when the page hydrates. A
 * choice made in the moment between the two never reaches React, and the next render
 * writes the old value back, so the choice disappears under the learner's hand. That
 * window is short on a laptop and long on a phone on a slow connection.
 *
 * This adopts whatever the control already shows, once, as React takes it over.
 */
export function useAdoptPreHydrationChoice<T extends string>(
  value: T,
  onChange: (next: T) => void,
): RefCallback<HTMLSelectElement> {
  const adopted = useRef(false);
  return (element) => {
    if (adopted.current || element === null) return;
    adopted.current = true;
    if (element.value !== value) onChange(element.value as T);
  };
}
