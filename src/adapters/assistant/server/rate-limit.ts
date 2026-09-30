/*
 * A fixed-window rate limit per client and route, for the assistant's routes, the only
 * code on the server that runs per request (tests/unit/scripts/public-surface.test.ts).
 * It lives in process memory: enough for the single long-running server the bridge needs
 * anyway (docs/DEPLOYMENT.md). On a serverless host each instance keeps its own count, so
 * there it is a floor, not a ceiling.
 *
 * The client is the first address in X-Forwarded-For, set by the proxy in front (Caddy on
 * the VPS, Vercel), or "local" without one.
 */

export interface RateLimit {
  /** Requests per window. */
  limit: number;
  windowMs: number;
}

/** A person chatting sends a few prompts a minute; polling the bridge sends one a second. */
export const LIMITS = {
  reply: { limit: 30, windowMs: 60_000 },
  bridge: { limit: 240, windowMs: 60_000 },
  mcp: { limit: 240, windowMs: 60_000 },
} as const satisfies Record<string, RateLimit>;

interface Window {
  start: number;
  count: number;
}

const GLOBAL_KEY = Symbol.for('understory.assistant.rate-limit');
type Holder = { [GLOBAL_KEY]?: Map<string, Window> };

function windows(): Map<string, Window> {
  const holder = globalThis as Holder;
  // A globalThis singleton, so a dev hot reload does not reset the counts.
  holder[GLOBAL_KEY] ??= new Map();
  return holder[GLOBAL_KEY];
}

export function clientOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}

/** True when the request may go ahead; counts it either way. */
export function allow(key: string, { limit, windowMs }: RateLimit, now = Date.now()): boolean {
  const all = windows();
  const current = all.get(key);
  if (!current || now - current.start >= windowMs) {
    all.set(key, { start: now, count: 1 });
    // Drops finished windows now and then, so the map cannot grow without end.
    if (all.size > 10_000) {
      for (const [k, w] of all) if (now - w.start >= windowMs) all.delete(k);
    }
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

/** A 429 in the assistant's error shape, or null when the request may go ahead. */
export function limited(request: Request, route: keyof typeof LIMITS): Response | null {
  const rule = LIMITS[route];
  if (allow(`${route}:${clientOf(request)}`, rule)) return null;
  return Response.json(
    { error: { code: 'rate-limited', message: 'Too many requests. Wait a minute and try again.' } },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(rule.windowMs / 1000)),
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** For tests. */
export function resetRateLimits(): void {
  windows().clear();
}
