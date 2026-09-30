export function publicDefines(env: Record<string, string | undefined>): Record<string, string> {
  // Replace this. It passes every variable to the browser, secrets included.
  const defines: Record<string, string> = {};
  for (const name of Object.keys(env)) {
    const value = env[name];
    defines[`process.env.${name}`] = JSON.stringify(value);
  }
  return defines;
}
