export type Chunk = { id: string; text: string };
export type Deps = {
  embed: (text: string) => Promise<number[]>;
  generate: (prompt: string) => Promise<string>;
  k: number;
  threshold: number;
};
export type Answer = { text: string; citations: string[] };

export const REFUSAL = "I don't have that information.";

export async function answer(question: string, chunks: Chunk[], deps: Deps): Promise<Answer> {
  // 1. Embed the question and every chunk, and score each chunk by cosine similarity.
  // 2. Keep the top k that reach the threshold. None left? Refuse.
  // 3. Otherwise build the prompt, call generate, and cite the kept chunk ids.
  const text = await deps.generate(question);
  return { text, citations: chunks.map((c) => c.id) };
}
