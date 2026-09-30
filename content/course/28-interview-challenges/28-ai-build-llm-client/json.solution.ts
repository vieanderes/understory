export type Complete = (prompt: string) => Promise<string>;

// Models often wrap JSON in a code fence, with or without `json` after the backticks.
export function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export async function completeJson<T>(
  complete: Complete,
  prompt: string,
  isValid: (value: unknown) => value is T,
): Promise<T> {
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    // The re-ask says what was wrong, which is usually enough for the model to fix it.
    const text = attempt === 0 ? prompt : `${prompt}\n\nYour last reply was invalid: ${problem}. Reply with JSON only.`;
    const reply = await complete(text);
    let value: unknown;
    try {
      value = JSON.parse(stripFences(reply));
    } catch {
      problem = 'not valid JSON';
      continue;
    }
    if (isValid(value)) return value;
    problem = 'wrong shape';
  }
  throw new Error(`No valid JSON after one re-ask: ${problem}`);
}
