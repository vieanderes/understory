export interface Sink {
  name: string; // "log", "error", "url", "analytics", "prompt"
  text: string; // everything that sink received, as text
}

export function leakedSinks(canaries: string[], sinks: Sink[]): string[] {
  const leaked: string[] = [];
  for (const sink of sinks) {
    if (canaries.some((canary) => sink.text.includes(canary))) leaked.push(sink.name);
  }
  return leaked;
}
