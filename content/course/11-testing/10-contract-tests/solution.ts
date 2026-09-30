export type Shape = 'number' | 'string' | 'boolean' | { [field: string]: Shape };

function kind(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function mismatches(shape: Shape, actual: unknown, path = ''): string[] {
  if (typeof shape === 'string') {
    const got = kind(actual);
    return got === shape ? [] : [`${path}: expected ${shape}, got ${got}`];
  }
  if (kind(actual) !== 'object') return [`${path}: expected object, got ${kind(actual)}`];
  const record = actual as Record<string, unknown>;
  const problems: string[] = [];
  for (const [field, inner] of Object.entries(shape)) {
    const where = path === '' ? field : `${path}.${field}`;
    if (!(field in record)) problems.push(`missing ${where}`);
    else problems.push(...mismatches(inner, record[field], where));
  }
  return problems;
}
