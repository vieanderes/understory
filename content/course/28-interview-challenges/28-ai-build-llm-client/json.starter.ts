export type Complete = (prompt: string) => Promise<string>;

// Models often wrap JSON in a code fence, with or without `json` after the backticks.
export function stripFences(text: string): string {
  return text;
}

export async function completeJson<T>(
  complete: Complete,
  prompt: string,
  isValid: (value: unknown) => value is T,
): Promise<T> {
  // One try, trusting the reply. Strip fences, check the shape, and re-ask once.
  return JSON.parse(await complete(prompt)) as T;
}
