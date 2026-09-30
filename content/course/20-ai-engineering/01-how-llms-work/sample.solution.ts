export type SampleOptions = { temperature: number; topK: number; topP: number };

// Subtracting the largest score first keeps Math.exp from overflowing to Infinity,
// and gives the same probabilities.
export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - max));
  const sum = exps.reduce((total, e) => total + e, 0);
  return exps.map((e) => e / sum);
}

export function sample(logits: number[], options: SampleOptions, random: () => number): number {
  if (options.temperature === 0) return logits.indexOf(Math.max(...logits));

  const probs = softmax(logits.map((logit) => logit / options.temperature));
  const ranked = probs.map((p, id) => ({ id, p })).sort((a, b) => b.p - a.p);

  // Top-k, then top-p: keep tokens while the running total is still under topP.
  const kept: { id: number; p: number }[] = [];
  let cumulative = 0;
  for (const candidate of ranked.slice(0, options.topK)) {
    if (cumulative >= options.topP) break;
    kept.push(candidate);
    cumulative += candidate.p;
  }

  // Throw a dart along the kept probabilities, scaled to their total.
  let dart = random() * cumulative;
  for (const candidate of kept) {
    dart -= candidate.p;
    if (dart <= 0) return candidate.id;
  }
  // Rounding can leave a sliver past the end.
  return kept[kept.length - 1]?.id ?? 0;
}
