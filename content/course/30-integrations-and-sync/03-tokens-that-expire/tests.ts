import { createTokenSource, NeedsReconnectError, OAuthError, type Connection, type Store } from './solution';

const HOUR = 3_600_000;

function makeStore(connection: Connection) {
  const rows = new Map<string, Connection>([['gym-1', connection]]);
  const store: Store = {
    async get(id) {
      await Promise.resolve();
      return { ...rows.get(id)! };
    },
    async save(id, next) {
      await Promise.resolve();
      rows.set(id, { ...next });
    },
  };
  return { store, rows };
}

// A vendor that rotates refresh tokens and rejects a used one, as RFC 9700 describes.
function makeVendor() {
  let issued = 0;
  const live = new Set(['refresh-0']);
  const used: string[] = [];
  async function refresh(refreshToken: string) {
    used.push(refreshToken);
    for (let tick = 0; tick < 3; tick++) await Promise.resolve();
    if (!live.delete(refreshToken)) throw new OAuthError('invalid_grant');
    issued += 1;
    live.add(`refresh-${issued}`);
    return { access_token: `access-${issued}`, refresh_token: `refresh-${issued}`, expires_in: 3600 };
  }
  return { refresh, used };
}

const expired: Connection = { accessToken: 'access-0', refreshToken: 'refresh-0', expiresAt: 0, needsReconnect: false };

test('a token with time to spare is returned without a refresh', async () => {
  const { store } = makeStore({ ...expired, expiresAt: 10 * HOUR });
  const vendor = makeVendor();
  const getAccessToken = createTokenSource(store, vendor.refresh, () => HOUR);
  expect(await getAccessToken('gym-1')).toBe('access-0');
  expect(vendor.used).toEqual([]);
});

test('a token inside the margin is refreshed early and saved with its expiry', async () => {
  const { store, rows } = makeStore({ ...expired, expiresAt: HOUR + 30_000 });
  const vendor = makeVendor();
  const getAccessToken = createTokenSource(store, vendor.refresh, () => HOUR, 60_000);
  expect(await getAccessToken('gym-1')).toBe('access-1');
  expect(rows.get('gym-1')).toEqual({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: 2 * HOUR,
    needsReconnect: false,
  });
});

test('five callers at once share one refresh', async () => {
  const { store } = makeStore(expired);
  const vendor = makeVendor();
  const getAccessToken = createTokenSource(store, vendor.refresh, () => HOUR);
  const tokens = await Promise.all([1, 2, 3, 4, 5].map(() => getAccessToken('gym-1')));
  expect(tokens).toEqual(['access-1', 'access-1', 'access-1', 'access-1', 'access-1']);
  expect(vendor.used).toEqual(['refresh-0']);
});

test('the next refresh uses the rotated refresh token', async () => {
  const { store } = makeStore(expired);
  const vendor = makeVendor();
  let clock = HOUR;
  const getAccessToken = createTokenSource(store, vendor.refresh, () => clock);
  await getAccessToken('gym-1');
  clock += 2 * HOUR;
  expect(await getAccessToken('gym-1')).toBe('access-2');
  expect(vendor.used).toEqual(['refresh-0', 'refresh-1']);
});

test('a reply without a refresh token keeps the old one', async () => {
  const { store, rows } = makeStore(expired);
  const refresh = async () => ({ access_token: 'access-9', expires_in: 600 });
  const getAccessToken = createTokenSource(store, refresh, () => HOUR);
  await getAccessToken('gym-1');
  expect(rows.get('gym-1')?.refreshToken).toBe('refresh-0');
});

test('invalid_grant marks the connection for reconnect, and later calls stop asking', async () => {
  const { store, rows } = makeStore({ ...expired, refreshToken: 'revoked' });
  const vendor = makeVendor();
  const getAccessToken = createTokenSource(store, vendor.refresh, () => HOUR);
  for (let attempt = 0; attempt < 2; attempt++) {
    let failed: unknown = null;
    try {
      await getAccessToken('gym-1');
    } catch (error) {
      failed = error;
    }
    expect(failed).toBeInstanceOf(NeedsReconnectError);
  }
  expect(rows.get('gym-1')?.needsReconnect).toBe(true);
  expect(vendor.used).toEqual(['revoked']);
});

test('after a network error, the next call tries again', async () => {
  const { store } = makeStore(expired);
  let calls = 0;
  const refresh = async () => {
    calls += 1;
    if (calls === 1) throw new Error('socket hang up');
    return { access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 };
  };
  const getAccessToken = createTokenSource(store, refresh, () => HOUR);
  let failed = false;
  try {
    await getAccessToken('gym-1');
  } catch {
    failed = true;
  }
  expect(failed).toBe(true);
  expect(await getAccessToken('gym-1')).toBe('access-2');
});
