export type Fields = Record<string, string | number | boolean>;

// Personal data never reaches the logs: the value is replaced, the key stays.
const PERSONAL = ['email', 'prompt', 'password'];

export function logLine(requestId: string, event: string, fields: Fields): string {
  const record: Fields = { requestId, event };
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'requestId' || key === 'event') continue;
    record[key] = PERSONAL.includes(key) ? '[redacted]' : value;
  }
  return JSON.stringify(record);
}
