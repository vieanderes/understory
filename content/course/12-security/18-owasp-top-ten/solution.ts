export async function isAllowed(check: () => Promise<unknown>): Promise<boolean> {
  try {
    return (await check()) === true;
  } catch {
    return false;
  }
}
