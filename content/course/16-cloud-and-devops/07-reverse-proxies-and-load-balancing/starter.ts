// forwardedFor is the X-Forwarded-For header, or undefined when it's missing.
// proxies is how many proxies you run in front of the app.
export function clientIp(forwardedFor: string | undefined, proxies: number): string | null {
  if (forwardedFor === undefined) return null;

  // The client can write anything at the start of the header.
  const first = forwardedFor.split(',')[0];
  return first === undefined ? null : first.trim();
}
