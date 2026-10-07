/*
 * zod, as Understory uses it. Import it from here, `import * as z from '@/core/zod'`, never
 * from 'zod' directly (ESLint enforces it).
 *
 * zod's own `z` is a namespace that also re-exports `locales`, every language's error
 * messages. Rollup and Webpack shake what goes unused; Turbopack keeps the whole namespace,
 * so `import { z } from 'zod'` put about 40 KB of locales (gzip) on every page
 * (tests/e2e/bundle-budget.spec.ts). Named re-exports shake, so this module lists exactly
 * what the code uses. A schema that needs another builder adds it here.
 */
export {
  array,
  boolean,
  discriminatedUnion,
  enum,
  instanceof,
  int,
  iso,
  literal,
  number,
  object,
  record,
  strictObject,
  string,
  union,
  unknown,
  url,
  uuid,
} from 'zod';
export type { core, infer, ZodType, ZodTypeAny } from 'zod';
