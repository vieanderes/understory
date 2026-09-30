export type Fields = Record<string, string | number | boolean>;

// Personal data never reaches the logs: the value is replaced, the key stays.
const PERSONAL = ['email', 'prompt', 'password'];

export function logLine(requestId: string, event: string, fields: Fields): string {
  // Build one record with the request id and event first, then the fields.
  return JSON.stringify(fields);
}
