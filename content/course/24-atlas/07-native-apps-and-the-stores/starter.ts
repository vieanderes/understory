// True when `version` is older than `minimum`. Both look like "2.10.0": three whole numbers.
export function isOlder(version: string, minimum: string): boolean {
  return version < minimum;
}
