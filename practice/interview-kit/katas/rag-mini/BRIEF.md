# RAG mini

Format: AI engineering take-home or an AI-native online task, 90 to 120 minutes.
TypeScript. RAG is the most common AI build brief; a common spec is exactly this one.

## The prompt

"Here is a folder of help articles. Build the core of an assistant that answers questions
from them, cites where each answer came from, and says it does not know when the articles
do not cover the question. Show us how you know it works."

Start with the eval. One interviewer is quoted as calling it a red flag when a candidate
does not.

## The contract

Given, in `fixtures/`: five help articles in `docs/`, `loadDocs()`, a deterministic
`createFakeEmbedder()`, the shared types in `contracts.ts`, and an optional real model in
`anthropic-generate.ts` used only when `ANTHROPIC_API_KEY` is set.

Implement in `src/rag.ts`:

- `chunkMarkdown(doc, { size = 500, overlap = 75 })`: split at headings, never across one.
  Within a section, windows of whole words of at most `size` characters, each repeating
  up to `overlap` characters of the previous window's tail. Chunk ids are
  `${docId}#${n}`. `overlap >= size` is a `RangeError`.
- `cosine(a, b)`: 0 when either vector is all zeros; throws when lengths differ.
- `topK(query, items, k)`: best first, ties in input order.
- `buildIndex(chunks, embedder)`: one batched `embed` call for all chunks. Returns
  `{ search(query, k) }` giving `{ chunk, score }` hits.
- `answer(question, index, { k = 3, threshold = 0.2, generate? })`:
  - keep hits scoring at least `threshold`; if none, refuse without calling `generate`;
  - number the sources from 1 and call `generate({ question, sources })`. Without a
    `generate`, quote the first sentence of each source followed by `[n]`;
  - citations are the sources the text cites as `[n]`, in order. If the text cites
    nothing, or cites a number it was not given, refuse;
  - a refusal is `{ status: 'refused', text: REFUSAL, citations: [] }`.

Implement in `src/metrics.ts`: `recallAtK(retrieved, relevant, k)` and
`reciprocalRank(retrieved, relevant)` over document ids, counting a document once.

Then run the eval: `pnpm eval:rag` (your code) or `pnpm eval:rag --solution`. It reads
`eval/golden.json`, prints recall@3, MRR and answer-or-refuse accuracy, and fails below a
gate. Add `--llm` with `ANTHROPIC_API_KEY` set to answer with Claude instead of quoting.

## Constraints

- No vector database, no framework. It all fits in memory.
- The fake embedder is lexical on purpose. The reference solution still misses two golden
  questions; read the eval output and be ready to explain both.

## What the interviewer looks for

- An eval before tuning, and retrieval metrics kept apart from answer quality.
- Chunking choices you can defend: size, overlap, headings as boundaries, heading text
  in the embedding.
- Refusal decided in code from the scores, not left to the model.
- Citations checked against what was actually retrieved.
- Prompt injection: retrieved text is data, never instructions. Look at the last golden
  question.
- Talk: hybrid search (BM25 plus vectors), re-ranking, how you would pick the threshold
  from the eval, faithfulness scoring with an LLM judge, cost and latency per question,
  and per-tenant isolation of documents.

Run: `pnpm kata rag-mini`. Reference: `pnpm kata rag-mini --solution`.
