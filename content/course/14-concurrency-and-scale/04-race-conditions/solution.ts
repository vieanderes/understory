// Wraps `fetchToken` so that callers who arrive while a fetch is running share it.
export function singleFlight(fetchToken: () => Promise<string>): () => Promise<string> {
  let inFlight: Promise<string> | null = null;
  return () => {
    // Setting inFlight before any await leaves no gap between the check and the write.
    if (inFlight === null) {
      inFlight = fetchToken().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
