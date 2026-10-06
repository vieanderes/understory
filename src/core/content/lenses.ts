/*
 * The angles a senior engineer checks code from before it ships, in the order a lecture
 * reads them (docs/LECTURE-BRIEF.md, "Before you ship"). Kept free of zod, so the lecture
 * builder can import them without the schema library.
 */
export const VERIFY_LENSES = ['breaks', 'scales', 'confuses', 'leaks', 'tests'] as const;
export type VerifyLens = (typeof VERIFY_LENSES)[number];
