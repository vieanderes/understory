import type { KeyValue } from './bridge-store';
import { getKeyValue } from './kv';

/*
 * A fixed-window rate limit per client and route, for the assistant's routes, the only
 * code on the server that runs per request (tests/unit/scripts/public-surface.test.ts).
 * The counts live in the bridge's store: in process memory on one long-running server,
 * in Redis when it is configured, so on a serverless host every instance shares one count
 * and the limit is a ceiling, not a floor per instance.
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

/**
 * Wrong pairing codes or tab secrets a client may send before it is shut out for a while.
 * Nobody retypes a code twenty times; something guessing does.
 */
export const FAILURES: RateLimit = { limit: 20, windowMs: 10 * 60_000 };

export function clientOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}

/** True when the request may go ahead; counts it either way. */
export async function allow(
  kv: KeyValue,
  key: string,
  { limit, windowMs }: RateLimit,
  now = Date.now(),
): Promise<boolean> {
  const window = Math.floor(now / windowMs);
  return (await kv.increment(`rate:${key}:${window}`, windowMs)) <= limit;
}

function tooMany(windowMs: number, message: string): Response {
  return Response.json(
    { error: { code: 'rate-limited', message } },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(windowMs / 1000)),
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** A 429 in the assistant's error shape, or null when the request may go ahead. */
export async function limited(
  request: Request,
  route: keyof typeof LIMITS,
  kv: KeyValue = getKeyValue(),
): Promise<Response | null> {
  const client = clientOf(request);
  if (await lockedOut(kv, client)) {
    return tooMany(FAILURES.windowMs, 'Too many wrong codes. Wait ten minutes and try again.');
  }
  const rule = LIMITS[route];
  if (await allow(kv, `${route}:${client}`, rule)) return null;
  return tooMany(rule.windowMs, 'Too many requests. Wait a minute and try again.');
}

function failureKey(client: string): string {
  return `failures:${client}`;
}

/** Counts a wrong pairing code or tab secret against the client. */
export async function recordFailure(kv: KeyValue, client: string): Promise<void> {
  await kv.increment(failureKey(client), FAILURES.windowMs);
}

export async function lockedOut(kv: KeyValue, client: string): Promise<boolean> {
  return Number((await kv.get(failureKey(client))) ?? 0) >= FAILURES.limit;
}
