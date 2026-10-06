export interface Intent {
  name: string;
  examples: string[]; // things a user might say
  route: string; // the tool that handles it, or '' if not decided yet
}

export function checkIntentMap(intents: Intent[], tools: string[]): string[] {
  const problems: string[] = [];
  const firstUse = new Map<string, string>(); // example, as compared, to the intent that has it
  for (const { name, examples, route } of intents) {
    if (route === '') problems.push(`${name}: no route`);
    else if (!tools.includes(route)) problems.push(`${name}: unknown tool ${route}`);
    if (name !== 'fallback' && examples.length < 2) problems.push(`${name}: needs 2 examples`);
    for (const example of examples) {
      const key = example.trim().toLowerCase();
      const owner = firstUse.get(key);
      if (owner === undefined) firstUse.set(key, name);
      else if (owner !== name) problems.push(`${name}: "${example}" is also in ${owner}`);
    }
  }
  if (!intents.some((intent) => intent.name === 'fallback')) problems.push('no fallback');
  return problems;
}
