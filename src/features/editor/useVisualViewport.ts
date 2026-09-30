import { useSyncExternalStore } from 'react';

/*
 * Where the visual viewport sits inside the layout viewport, in CSS pixels. iOS and
 * Android both keep the layout viewport at full height while the on-screen keyboard is
 * up, so `position: fixed; bottom: 0` ends up underneath it. The visual viewport is the
 * only place the keyboard shows up; a bar that must ride on the keyboard's top edge is
 * laid out from these numbers.
 */

export interface VisualViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
  /** How much of the layout viewport the keyboard covers. 0 when it is down. */
  keyboard: number;
}

/** Smaller differences are browser chrome or rounding, not a keyboard. */
const KEYBOARD_MIN_PX = 120;

const AT_REST: VisualViewportRect = { top: 0, left: 0, width: 0, height: 0, keyboard: 0 };

/** The last snapshot. `useSyncExternalStore` needs the same object back when nothing moved. */
let last = AT_REST;

function subscribe(notify: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  viewport.addEventListener('resize', notify);
  viewport.addEventListener('scroll', notify);
  return () => {
    viewport.removeEventListener('resize', notify);
    viewport.removeEventListener('scroll', notify);
  };
}

function snapshot(): VisualViewportRect {
  const viewport = window.visualViewport;
  if (!viewport) return AT_REST;
  const top = Math.round(viewport.offsetTop);
  const left = Math.round(viewport.offsetLeft);
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);
  // A pinch-zoom also shrinks the visual viewport. That is not a keyboard.
  const zoomed = Math.abs(viewport.scale - 1) > 0.01;
  const covered = Math.round(window.innerHeight - height - top);
  const keyboard = !zoomed && covered >= KEYBOARD_MIN_PX ? covered : 0;
  if (
    top !== last.top ||
    left !== last.left ||
    width !== last.width ||
    height !== last.height ||
    keyboard !== last.keyboard
  ) {
    last = { top, left, width, height, keyboard };
  }
  return last;
}

export function useVisualViewport(): VisualViewportRect {
  return useSyncExternalStore(subscribe, snapshot, () => AT_REST);
}
