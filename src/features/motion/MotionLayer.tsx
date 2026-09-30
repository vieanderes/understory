'use client';

import dynamic from 'next/dynamic';

/*
 * The motion layer loads after hydration, never in the bundle a page hydrates with. GSAP,
 * SplitText and Lenis are work the main thread would otherwise do before React can answer
 * a click; on a slow phone that delay swallowed choices made in the first second. The
 * head script and CSS hold arriving elements back meanwhile, with a failsafe.
 */
export const Arrival = dynamic(() => import('./Arrival').then((m) => m.Arrival), { ssr: false });

export const SmoothScroll = dynamic(() => import('./SmoothScroll').then((m) => m.SmoothScroll), {
  ssr: false,
});
