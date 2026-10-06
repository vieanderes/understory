export interface Intent {
  name: string;
  examples: string[]; // things a user might say
  route: string; // the tool that handles it, or '' if not decided yet
}

export function checkIntentMap(intents: Intent[], tools: string[]): string[] {
  const problems: string[] = [];
  // No checks yet, so every map looks fine.
  return problems;
}
