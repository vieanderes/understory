'use client';

import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { useEffect } from 'react';
import { gsap } from './gsap';

/*
 * Wheel and trackpad scrolling that glides instead of stepping. Touch keeps the native iOS
 * and Android scroll (syncTouch off), and Lenis turns itself off under reduced motion.
 * Nested scrollers, such as a code block or a lab's panel, keep their own scroll.
 */
const OPTIONS = {
  autoRaf: false,
  lerp: 0.1,
  allowNestedScroll: true,
  stopInertiaOnNavigate: true,
} as const;

/**
 * Mounted in the (app) layout only, through MotionLayer, so it loads after hydration. A
 * lesson in focus mode scrolls natively.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis(OPTIONS);
    // One clock for scroll and tweens, so a scroll-linked animation never lags a frame.
    const tick = (seconds: number): void => lenis.raf(seconds * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
