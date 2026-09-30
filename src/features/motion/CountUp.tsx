'use client';

import { useEffect, useRef } from 'react';
import { motionAllowed } from './allowed';
import { DURATION, EASE } from './tokens';

const WHOLE = /^([+-]?)(\d+)$/;

/**
 * A figure that counts to its value when it first appears, and from its old value to the
 * new one when it changes. Only whole numbers count; anything else (a placeholder, a
 * fraction) is shown as it is.
 *
 * The tween writes to the text node React rendered, never replaces it, so React's next
 * update lands on the node that is on screen. Tabular digits keep the width still.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useEffect(() => {
    const text = ref.current?.firstChild;
    const match = WHOLE.exec(value);
    if (!(text instanceof Text) || !match) {
      shown.current = null;
      return;
    }
    const [, sign = '', digits = '0'] = match;
    const to = Number(digits);
    const from = shown.current ?? 0;
    if (from === to || !motionAllowed()) {
      shown.current = to;
      text.nodeValue = value;
      return;
    }

    // `shown` moves only when a count finishes, so a count cut short (Strict Mode runs
    // effects twice in development) starts again instead of freezing halfway. GSAP loads
    // here, on the first count, so it never sits in the bundle a page hydrates with.
    let tween: { kill: () => void } | undefined;
    let cancelled = false;
    void import('./gsap').then(({ gsap }) => {
      if (cancelled) return;
      const counter = { n: from };
      tween = gsap.to(counter, {
        n: to,
        duration: DURATION.arrive,
        ease: EASE.out.gsap,
        onUpdate: () => {
          text.nodeValue = `${sign}${Math.round(counter.n)}`;
        },
        onComplete: () => {
          shown.current = to;
        },
      });
    });
    return () => {
      cancelled = true;
      tween?.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
