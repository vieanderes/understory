/**
 * Produces unique, sortable ids for events. Core supplies the UUIDv7 algorithm
 * (src/core/util/uuid.ts); a real adapter wraps `crypto.getRandomValues` behind this
 * port so core never touches a global directly.
 */
export interface IdGen {
  next(): string;
}
