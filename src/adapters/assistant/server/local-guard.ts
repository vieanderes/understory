/*
 * The local Claude account provider runs `claude` with whoever is logged in on the machine
 * that serves the app. On a shared server that would hand every visitor the owner's
 * account, so the route answers only when the server is someone's own machine and the
 * request comes from that machine.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface GuardEnv {
  ASSISTANT_LOCAL_CLI?: string;
  NODE_ENV?: string;
}

export function localCliEnabled(env: GuardEnv): boolean {
  return env.ASSISTANT_LOCAL_CLI === '1' || env.NODE_ENV === 'development';
}

/** The host part of a Host header or URL host, without the port. */
function hostname(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith('[')) return trimmed.slice(0, trimmed.indexOf(']') + 1);
  // A bare IPv6 address has several colons and no port.
  if (trimmed.split(':').length > 2) return trimmed;
  return trimmed.split(':')[0] ?? '';
}

export function isLocalHost(host: string | null | undefined): boolean {
  return host ? LOCAL_HOSTS.has(hostname(host)) : false;
}

/**
 * Checks the Host header (a DNS-rebinding page names its own host there) and, when the
 * browser sends one, the Origin (so another site cannot post to localhost from a tab).
 */
export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (!isLocalHost(host)) return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false;
  }
}

export function localCliAllowed(request: Request, env: GuardEnv = process.env): boolean {
  return localCliEnabled(env) && isLocalRequest(request);
}
