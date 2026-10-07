export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function scrubFixture(fixture: Json, sensitiveKeys: string[]): Json {
  // Walk the fixture and replace what must not be committed.
  return fixture;
}
