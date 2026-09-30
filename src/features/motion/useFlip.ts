'use client';

import { Flip } from 'gsap/Flip';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap, motionAllowed } from './gsap';
import { DURATION, EASE } from './tokens';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

/**
 * Layout that changes without jumping. Call `capture()` just before the state change that
 * moves things (a filter, a sort); once React has committed, what stayed glides from its
 * old place to its new one and what is new fades in. It runs at the interaction tempo:
 * this is work, not arrival. Kept out of gsap.ts so only screens that use it pay for Flip.
 */
export function useFlip(
  scope: RefObject<HTMLElement | null>,
  selector: string,
  change: unknown,
): () => void {
  const captured = useRef<Flip.FlipState | null>(null);

  useLayoutEffect(() => {
    const state = captured.current;
    captured.current = null;
    if (!state) return;
    const flip = Flip.from(state, {
      duration: DURATION.answer,
      ease: EASE.out.gsap,
      onEnter: (entering) => gsap.from(entering, { opacity: 0, duration: DURATION.answer }),
    });
    return () => {
      flip.progress(1).kill();
    };
  }, [change]);

  return () => {
    if (scope.current && motionAllowed()) {
      captured.current = Flip.getState(scope.current.querySelectorAll(selector));
    }
  };
}
