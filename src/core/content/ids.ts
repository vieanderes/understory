import { z } from 'zod';

/*
 * The id formats, apart from the lesson schema: the event log checks ids too, and it is
 * on every page, while the lesson schema with its author hints is needed only where
 * lessons are validated (bundle-budget.spec.ts).
 */

/** `js.closures`, `db.isolation-levels`: dotted, lowercase, never reused once published. */
export const idSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/,
    'An id is dotted lowercase, for example "js.closures" or "db.isolation-levels".',
  );

/** A module id: one lowercase word. */
export const moduleIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".');

/** Step and card ids are local to their lesson: `predict-total`, `card-2`. */
export const localIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'A local id is lowercase words joined by hyphens.');
