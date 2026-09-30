// forwardedFor is the X-Forwarded-For header, or undefined when it's missing.
// proxies is how many proxies you run in front of the app.
export function clientIp(forwardedFor: string | undefined, proxies: number): string | null {
  if (forwardedFor === undefined) return null;

  const parts = forwardedFor.split(',');
  const entry = parts[parts.length - proxies];
  return entry === undefined ? null : entry.trim();
}
