export interface Sink {
  name: string; // "log", "error", "url", "analytics", "prompt"
  text: string; // everything that sink received, as text
}

export function leakedSinks(canaries: string[], sinks: Sink[]): string[] {
  // An empty string is inside every text, so it would flag every sink.
  const needles = canaries
    .filter((canary) => canary !== '')
    .flatMap((canary) => [canary, encodeURIComponent(canary)])
    .map((needle) => needle.toLowerCase());
  const leaked: string[] = [];
  for (const sink of sinks) {
    const text = sink.text.toLowerCase();
    if (needles.some((needle) => text.includes(needle)) && !leaked.includes(sink.name)) {
      leaked.push(sink.name);
    }
  }
  return leaked;
}
