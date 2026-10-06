export interface Connection {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // milliseconds since 1970, like Date.now()
  needsReconnect: boolean;
}

export interface Store {
  get(connectionId: string): Promise<Connection>;
  save(connectionId: string, connection: Connection): Promise<void>;
}

// The vendor's token endpoint. It throws an OAuthError when it refuses.
export type Refresh = (
  refreshToken: string,
) => Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;

export class OAuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class NeedsReconnectError extends Error {}

export function createTokenSource(store: Store, refresh: Refresh, now: () => number, marginMs = 60_000) {
  const inFlight = new Map<string, Promise<string>>();

  async function load(connectionId: string): Promise<string> {
    // Read inside the flight, so nobody acts on a token another caller just replaced.
    const current = await store.get(connectionId);
    if (current.needsReconnect) throw new NeedsReconnectError(connectionId);
    if (now() < current.expiresAt - marginMs) return current.accessToken;
    try {
      const reply = await refresh(current.refreshToken);
      await store.save(connectionId, {
        accessToken: reply.access_token,
        // Rotation: a new refresh token replaces the old one, which is now dead.
        refreshToken: reply.refresh_token ?? current.refreshToken,
        expiresAt: now() + reply.expires_in * 1000,
        needsReconnect: false,
      });
      return reply.access_token;
    } catch (error) {
      if (error instanceof OAuthError && error.code === 'invalid_grant') {
        await store.save(connectionId, { ...current, needsReconnect: true });
        throw new NeedsReconnectError(connectionId);
      }
      throw error;
    }
  }

  return function getAccessToken(connectionId: string): Promise<string> {
    const running = inFlight.get(connectionId);
    if (running) return running;
    const promise = load(connectionId).finally(() => inFlight.delete(connectionId));
    inFlight.set(connectionId, promise);
    return promise;
  };
}
