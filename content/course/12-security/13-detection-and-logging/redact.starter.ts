const SENSITIVE = ['password', 'token', 'authorization', 'cookie', 'card'];

export function redact(entry: Record<string, unknown>): Record<string, unknown> {
  // Replace this. It only looks at the top level, and only at lowercase keys.
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(entry)) {
    out[key] = SENSITIVE.includes(key) ? '[redacted]' : entry[key];
  }
  return out;
}
