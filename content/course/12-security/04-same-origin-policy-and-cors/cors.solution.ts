export function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  if (allowed.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }
  return {};
}
