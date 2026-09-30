export type Shape = 'number' | 'string' | 'boolean' | { [field: string]: Shape };

export function mismatches(shape: Shape, actual: unknown, path = ''): string[] {
  // Replace this. Comparing whole objects fails on every extra field the provider adds.
  return JSON.stringify(Object.keys(shape as object)) === JSON.stringify(Object.keys(actual as object))
    ? []
    : [`${path || 'body'}: fields differ`];
}
