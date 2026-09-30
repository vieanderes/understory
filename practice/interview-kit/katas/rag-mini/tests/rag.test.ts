import { describe, expect, it, vi } from 'vitest';
import type { Chunk, Generate } from '../fixtures/contracts';
import { createFakeEmbedder } from '../fixtures/fake-embedder';
import { loadDocs } from '../fixtures/load-docs';
import { answer, buildIndex, chunkMarkdown, cosine, REFUSAL, topK } from '../src/rag';

const words = (n: number, prefix = 'w') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');

describe('chunkMarkdown', () => {
  it('splits at headings and records the heading on each chunk', () => {
    const chunks = chunkMarkdown({
      id: 'guide',
      markdown: 'Intro line.\n\n# First\n\nAlpha text.\n\n## Second\n\nBeta text.\n',
    });
    expect(chunks).toEqual([
      { id: 'guide#0', docId: 'guide', heading: '', text: 'Intro line.' },
      { id: 'guide#1', docId: 'guide', heading: 'First', text: 'Alpha text.' },
      { id: 'guide#2', docId: 'guide', heading: 'Second', text: 'Beta text.' },
    ]);
  });

  it('skips headings with no text under them', () => {
    const chunks = chunkMarkdown({ id: 'd', markdown: '# Empty\n\n# Full\n\nSome text.' });
    expect(chunks.map((c) => c.heading)).toEqual(['Full']);
  });

  it('keeps long sections under the size limit without cutting words', () => {
    const body = words(200);
    const chunks = chunkMarkdown(
      { id: 'd', markdown: `# Long\n\n${body}` },
      { size: 100, overlap: 20 },
    );
    expect(chunks.length).toBeGreaterThan(5);
    const vocabulary = new Set(body.split(' '));
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
      for (const word of chunk.text.split(' ')) expect(vocabulary.has(word)).toBe(true);
    }
  });

  it('overlaps neighbouring chunks and loses no words', () => {
    const body = words(120);
    const chunks = chunkMarkdown({ id: 'd', markdown: body }, { size: 80, overlap: 16 });
    for (let i = 1; i < chunks.length; i += 1) {
      const previous = chunks[i - 1]!.text.split(' ');
      const current = chunks[i]!.text.split(' ');
      expect(previous.slice(-1)[0]).toBe(current[current.indexOf(previous.slice(-1)[0]!)]);
      expect(current[0]).not.toBe(previous[0]);
      expect(previous).toContain(current[0]);
    }
    const covered = new Set(chunks.flatMap((c) => c.text.split(' ')));
    expect(covered.size).toBe(120);
  });

  it('rejects an overlap that is not smaller than the size', () => {
    expect(() => chunkMarkdown({ id: 'd', markdown: 'x' }, { size: 50, overlap: 50 })).toThrow(
      RangeError,
    );
  });
});

describe('cosine and topK', () => {
  it('computes cosine similarity, including for vectors that are not normalised', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1);
    expect(cosine([3, 4], [6, 8])).toBeCloseTo(1);
  });

  it('returns 0 for a zero vector and throws on mismatched lengths', () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
    expect(() => cosine([1], [1, 2])).toThrow();
  });

  it('returns the k best items, best first, ties in original order', () => {
    const items = [
      { vector: [0, 1], item: 'up' },
      { vector: [1, 0], item: 'right-a' },
      { vector: [1, 0], item: 'right-b' },
      { vector: [-1, 0], item: 'left' },
    ];
    expect(topK([1, 0], items, 2).map((r) => r.item)).toEqual(['right-a', 'right-b']);
    expect(topK([1, 0], items, 10)).toHaveLength(4);
  });
});

describe('buildIndex and answer', () => {
  async function helpIndex() {
    const embedder = createFakeEmbedder();
    const chunks = loadDocs().flatMap((doc) => chunkMarkdown(doc));
    const index = await buildIndex(chunks, embedder);
    return { index, embedder, chunks };
  }

  it('embeds all chunks in one batch call', async () => {
    const { embedder } = await helpIndex();
    expect(embedder.calls).toBe(1);
  });

  it('retrieves the relevant article first', async () => {
    const { index } = await helpIndex();
    const [hit] = await index.search('How long does the password reset link last?', 3);
    expect(hit!.chunk.docId).toBe('reset-password');
  });

  it('answers with citations that point at the sources it used', async () => {
    const { index } = await helpIndex();
    const result = await answer('Can I get a refund on a yearly plan?', index);
    expect(result.status).toBe('answered');
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]).toMatchObject({ n: 1, docId: 'billing', heading: 'Refunds' });
    for (const citation of result.citations) expect(result.text).toContain(`[${citation.n}]`);
  });

  it('refuses when nothing is similar enough, without calling the model', async () => {
    const { index } = await helpIndex();
    const generate = vi.fn<Generate>();
    const result = await answer('What is the capital of Peru?', index, { generate });
    expect(result).toEqual({ status: 'refused', text: REFUSAL, citations: [] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes numbered sources to the model and keeps only the citations it used', async () => {
    const { index } = await helpIndex();
    const generate = vi.fn<Generate>(async ({ sources }) => {
      expect(sources.map((s) => s.n)).toEqual(sources.map((_, i) => i + 1));
      return 'Use a backup code [1].';
    });
    const result = await answer(
      'I lost my phone and cannot sign in with two-step verification',
      index,
      {
        generate,
      },
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(result.status).toBe('answered');
    expect(result.citations).toEqual([
      expect.objectContaining({ n: 1, docId: 'two-step-verification' }),
    ]);
  });

  it('refuses a model answer that cites nothing or cites a source it was not given', async () => {
    const { index } = await helpIndex();
    const question = 'How do I export my workspace?';
    const uncited = await answer(question, index, { generate: async () => 'Just click export.' });
    const invented = await answer(question, index, { generate: async () => 'See [9].' });
    expect(uncited.status).toBe('refused');
    expect(invented.status).toBe('refused');
  });

  it('uses the threshold and k it is given', async () => {
    const search = vi.fn(async () => [
      { chunk: { id: 'a#0', docId: 'a', heading: 'H', text: 'Close match.' } as Chunk, score: 0.5 },
      { chunk: { id: 'b#0', docId: 'b', heading: 'H', text: 'Weak match.' } as Chunk, score: 0.1 },
    ]);
    const result = await answer('q', { search }, { k: 7, threshold: 0.3 });
    expect(search).toHaveBeenCalledWith('q', 7);
    expect(result.citations.map((c) => c.docId)).toEqual(['a']);
  });
});
