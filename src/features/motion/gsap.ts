'use client';

/*
 * The one place GSAP is imported (docs/MOTION.md, "two libraries, one gate"). Screens use
 * the primitives in this folder, so the whole motion vocabulary can be read in one place
 * and a plugin is registered exactly once.
 */
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, SplitText);
}

export { gsap, SplitText, useGSAP };

export { motionAllowed } from './allowed';
