import * as z from '@/core/zod';

/*
 * Apart from the glossary schema, because the event log checks term ids too and it is on
 * every page, while the authoring schema is needed only where content is validated.
 */

/** `pure-function`, `n-plus-one`: lowercase words and digits joined by hyphens. */
export const termIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'A term id is lowercase words joined by hyphens.');
