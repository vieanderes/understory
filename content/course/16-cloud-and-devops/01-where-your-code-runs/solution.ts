export type Env = Record<string, string | undefined>;

export function listenOptions(env: Env): { hostname: string; port: number } {
  if (env.PORT === undefined) return { hostname: '0.0.0.0', port: 3000 };
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a whole number from 1 to 65535, got "${env.PORT}"`);
  }
  return { hostname: '0.0.0.0', port };
}
