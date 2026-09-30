export function publicDefines(env: Record<string, string | undefined>): Record<string, string> {
  const defines: Record<string, string> = {};
  for (const name of Object.keys(env)) {
    const value = env[name];
    if (!name.startsWith('PUBLIC_')) continue;
    if (typeof value !== 'string') continue;
    defines[`process.env.${name}`] = JSON.stringify(value);
  }
  return defines;
}
