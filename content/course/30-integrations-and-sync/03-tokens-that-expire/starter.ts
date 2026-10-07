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
  return async function getAccessToken(connectionId: string): Promise<string> {
    // Refreshes only once the token has expired, and once per caller.
    const current = await store.get(connectionId);
    if (now() < current.expiresAt) return current.accessToken;
    const reply = await refresh(current.refreshToken);
    await store.save(connectionId, { ...current, accessToken: reply.access_token });
    return reply.access_token;
  };
}
