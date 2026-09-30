'use client';

import { motionAllowed } from './allowed';
import { DURATION, EASE } from './tokens';

/**
 * Applies a theme change so the new theme spreads out as a circle from the control that
 * asked for it. Without View Transitions or with reduced motion, it simply applies.
 */
export function revealTheme(apply: () => void, origin: HTMLElement): void {
  if (typeof document.startViewTransition !== 'function' || !motionAllowed()) {
    apply();
    return;
  }
  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const html = document.documentElement;
  html.dataset.themeSwitch = '';
  const transition = document.startViewTransition(apply);
  void transition.ready.then(() => {
    html.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: DURATION.arrive * 1000,
        easing: EASE.arrive.css,
        pseudoElement: '::view-transition-new(root)',
      },
    );
  });
  void transition.finished.finally(() => {
    delete html.dataset.themeSwitch;
  });
}
