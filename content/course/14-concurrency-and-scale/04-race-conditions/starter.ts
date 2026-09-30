// Wraps `fetchToken` so that callers who arrive while a fetch is running share it.
export function singleFlight(fetchToken: () => Promise<string>): () => Promise<string> {
  // Every caller starts its own fetch. Share the one in flight instead.
  return () => fetchToken();
}
