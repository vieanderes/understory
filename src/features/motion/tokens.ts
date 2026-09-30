/*
 * The motion tokens in src/styles/tokens.css, in the units GSAP takes (seconds, named
 * eases). CSS stays the source of truth; tests/unit/scripts/motion-tokens.test.ts fails
 * when the two drift.
 */

/** Seconds. Press and answer are the interaction tempo, arrive and stagger the arrival tempo. */
export const DURATION = {
  press: 0.15,
  answer: 0.24,
  arrive: 0.7,
  stagger: 0.06,
} as const;

/** Each GSAP ease with the cubic-bezier it stands for in CSS. */
export const EASE = {
  /** --ease-out: the expo out every interaction already uses. */
  out: { gsap: 'expo.out', css: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  /** --ease-arrive: a softer landing for things that enter. */
  arrive: { gsap: 'quint.out', css: 'cubic-bezier(0.22, 1, 0.36, 1)' },
} as const;
