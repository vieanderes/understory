// check() asks the new version's /health. It resolves true when healthy,
// false when not, and throws when nothing answers yet.
// pause() waits a moment between tries.
export async function waitUntilHealthy(
  check: () => Promise<boolean>,
  attempts: number,
  pause: () => Promise<void>,
): Promise<boolean> {
  // Asks once, and trusts the first answer.
  return await check();
}
