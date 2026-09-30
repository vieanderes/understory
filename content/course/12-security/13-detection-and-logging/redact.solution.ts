const SENSITIVE = ['password', 'token', 'authorization', 'cookie', 'card'];

export function redact(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(entry)) {
    const value = entry[key];
    if (SENSITIVE.includes(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else if (typeof value === 'object' && value !== null) {
      out[key] = redact(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
