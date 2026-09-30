// check() asks the new version's /health. It resolves true when healthy,
// false when not, and throws when nothing answers yet.
// pause() waits a moment between tries.
export async function waitUntilHealthy(
  check: () => Promise<boolean>,
  attempts: number,
  pause: () => Promise<void>,
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let healthy = false;
    try {
      healthy = await check();
    } catch {
      healthy = false; // still starting up, so nothing answered
    }
    if (healthy) return true;
    if (attempt < attempts) await pause();
  }
  return false;
}
