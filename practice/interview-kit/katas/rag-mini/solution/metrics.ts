/**
 * Retrieval metrics, kept apart from answer quality: if recall is low, no prompt will fix
 * the answers, and you want to know which half to work on.
 * Both work on document ids. Duplicates in `retrieved` (several chunks from one document)
 * count once, at their first position.
 */

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** Share of the relevant documents that appear in the first k distinct retrieved ones. */
export function recallAtK(
  retrieved: readonly string[],
  relevant: readonly string[],
  k: number,
): number {
  if (relevant.length === 0) return 1;
  const top = new Set(unique(retrieved).slice(0, k));
  return relevant.filter((id) => top.has(id)).length / relevant.length;
}

/** 1 / rank of the first relevant document, or 0 if none is retrieved. */
export function reciprocalRank(retrieved: readonly string[], relevant: readonly string[]): number {
  const rank = unique(retrieved).findIndex((id) => relevant.includes(id));
  return rank === -1 ? 0 : 1 / (rank + 1);
}
