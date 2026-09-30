// True when `version` is older than `minimum`. Both look like "2.10.0": three whole numbers.
export function isOlder(version: string, minimum: string): boolean {
  const parse = (text: string): number[] => {
    const parts = text.split('.').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
      throw new Error(`Not a version: ${text}`);
    }
    return parts;
  };
  const a = parse(version);
  const b = parse(minimum);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}
