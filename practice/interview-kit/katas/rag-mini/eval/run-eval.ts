/**
 * pnpm eval:rag [--solution] [--llm]
 *
 * A tiny golden-set eval. Retrieval is scored on its own (recall@k and MRR over the
 * answerable questions), then the answer step is scored on one thing we can check without
 * a judge: does it answer what it should and refuse what it should.
 * Exits non-zero below the gate, so it can guard a change in CI.
 * --llm uses Claude for the answer step when ANTHROPIC_API_KEY is set.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createAnthropicGenerate } from '../fixtures/anthropic-generate';
import { createFakeEmbedder } from '../fixtures/fake-embedder';
import { loadDocs } from '../fixtures/load-docs';

interface GoldenItem {
  question: string;
  relevant: string[];
}

const K = 3;
const GATE = { recall: 0.8, mrr: 0.7, refusalAccuracy: 0.8 };

const args = process.argv.slice(2);
const target =
  args.includes('--solution') || process.env.KATA_TARGET === 'solution' ? 'solution' : 'src';
const rag: typeof import('../src/rag') = await import(`../${target}/rag.ts`);
const metrics: typeof import('../src/metrics') = await import(`../${target}/metrics.ts`);

const golden: GoldenItem[] = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'golden.json'), 'utf8'),
);

let generate;
if (args.includes('--llm')) {
  generate = createAnthropicGenerate();
  if (!generate) console.log('ANTHROPIC_API_KEY is not set; using the extractive answerer.\n');
}

const chunks = loadDocs().flatMap((doc) => rag.chunkMarkdown(doc));
const index = await rag.buildIndex(chunks, createFakeEmbedder());

let recallSum = 0;
let rrSum = 0;
let answerable = 0;
let refusalCorrect = 0;

console.log(`Evaluating ${target}/ on ${golden.length} questions, k = ${K}\n`);
for (const item of golden) {
  const hits = await index.search(item.question, K);
  const retrieved = hits.map((hit) => hit.chunk.docId);
  const result = await rag.answer(item.question, index, { k: K, generate });
  const shouldAnswer = item.relevant.length > 0;
  const behaved = (result.status === 'answered') === shouldAnswer;
  if (behaved) refusalCorrect += 1;

  let line = `${behaved ? 'ok  ' : 'MISS'} ${result.status.padEnd(8)} ${item.question}`;
  if (shouldAnswer) {
    answerable += 1;
    const recall = metrics.recallAtK(retrieved, item.relevant, K);
    const rr = metrics.reciprocalRank(retrieved, item.relevant);
    recallSum += recall;
    rrSum += rr;
    line += `  (recall ${recall.toFixed(2)}, rr ${rr.toFixed(2)}, top ${hits[0]?.score.toFixed(2)})`;
  } else {
    line += `  (top score ${hits[0]?.score.toFixed(2) ?? 'none'})`;
  }
  console.log(line);
}

const summary = {
  recall: recallSum / answerable,
  mrr: rrSum / answerable,
  refusalAccuracy: refusalCorrect / golden.length,
};
console.log(
  `\nrecall@${K} ${summary.recall.toFixed(2)}   MRR ${summary.mrr.toFixed(2)}   ` +
    `answer/refuse accuracy ${summary.refusalAccuracy.toFixed(2)}`,
);

const failed = (Object.keys(GATE) as Array<keyof typeof GATE>).filter(
  (key) => summary[key] < GATE[key],
);
if (failed.length > 0) {
  console.log(`Below the gate: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('Gate passed.');
