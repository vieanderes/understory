/**
 * True when motion is allowed now. The head script sets the flag; the query can change
 * live. Kept apart from gsap.ts so a caller that only asks does not load GSAP.
 */
export function motionAllowed(): boolean {
  return (
    document.documentElement.dataset.motion === 'on' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
