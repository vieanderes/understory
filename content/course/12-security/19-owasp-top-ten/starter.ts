export async function isAllowed(check: () => Promise<unknown>): Promise<boolean> {
  // Replace this. When the check throws, it lets the request through: failing open.
  try {
    return Boolean(await check());
  } catch {
    return true;
  }
}
