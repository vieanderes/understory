export const PUBLIC_NAMES = ['SITE_NAME', 'MAPS_KEY', 'SUPPORT_EMAIL'];

export type Env = Record<string, string | undefined>;

export function publicConfig(env: Env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of PUBLIC_NAMES) {
    const value = env[name];
    if (value !== undefined) out[name] = value;
  }
  return out;
}
