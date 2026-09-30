export type SampleOptions = { temperature: number; topK: number; topP: number };

export function softmax(logits: number[]): number[] {
  const exps = logits.map((logit) => Math.exp(logit));
  const sum = exps.reduce((total, e) => total + e, 0);
  return exps.map((e) => e / sum);
}

export function sample(logits: number[], options: SampleOptions, random: () => number): number {
  // Always the likeliest token. Add temperature, top-k, top-p and a weighted draw.
  const probs = softmax(logits);
  return probs.indexOf(Math.max(...probs));
}
