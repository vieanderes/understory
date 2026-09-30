export type Health = { status: 200 | 503; body: string };
export type Sleep = (ms: number) => Promise<void>;

export async function health(pingDb: () => Promise<void>, sleep: Sleep, timeoutMs: number): Promise<Health> {
  return { status: 200, body: 'ok' };
}
