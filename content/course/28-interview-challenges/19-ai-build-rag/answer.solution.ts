export type Chunk = { id: string; text: string };
export type Deps = {
  embed: (text: string) => Promise<number[]>;
  generate: (prompt: string) => Promise<string>;
  k: number;
  threshold: number;
};
export type Answer = { text: string; citations: string[] };

export const REFUSAL = "I don't have that information.";

// A zero vector has no direction, so it matches nothing instead of producing NaN.
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

export async function answer(question: string, chunks: Chunk[], deps: Deps): Promise<Answer> {
  const [queryVector, ...chunkVectors] = await Promise.all([
    deps.embed(question),
    ...chunks.map((c) => deps.embed(c.text)),
  ]);
  const scored = chunks.map((c, i) => ({ chunk: c, score: cosine(queryVector ?? [], chunkVectors[i] ?? []) }));
  // sort is stable, so equal scores keep the order the chunks came in.
  scored.sort((a, b) => b.score - a.score);
  const kept = scored.slice(0, deps.k).filter((s) => s.score >= deps.threshold);
  // Refusing in code, before the model runs, means no prompt wording can talk it into guessing.
  if (kept.length === 0) return { text: REFUSAL, citations: [] };

  const context = kept.map((s) => `[${s.chunk.id}] ${s.chunk.text}`).join('\n');
  const prompt = `${context}\n\nQuestion: ${question}`;
  const text = (await deps.generate(prompt)).trim();
  return { text, citations: kept.map((s) => s.chunk.id) };
}
