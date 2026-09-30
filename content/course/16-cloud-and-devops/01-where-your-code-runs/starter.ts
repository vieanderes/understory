export type Env = Record<string, string | undefined>;

export function listenOptions(env: Env): { hostname: string; port: number } {
  return { hostname: 'localhost', port: 3000 };
}
