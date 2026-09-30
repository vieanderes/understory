export type Health = { status: 200 | 503; body: string };
export type Sleep = (ms: number) => Promise<void>;

export async function health(pingDb: () => Promise<void>, sleep: Sleep, timeoutMs: number): Promise<Health> {
  const ping = pingDb().then(
    (): Health => ({ status: 200, body: 'ok' }),
    (): Health => ({ status: 503, body: 'database unreachable' }),
  );
  const late = sleep(timeoutMs).then((): Health => ({ status: 503, body: 'database timeout' }));
  return Promise.race([ping, late]);
}
