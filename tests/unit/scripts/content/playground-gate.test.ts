import { describe, expect, it } from 'vitest';
import { jsdomPlaygroundGate, probePage } from '../../../../scripts/lib/playground-gate';
import type { PlaygroundStep } from '@/core/content/schema';
import { rawLesson } from '../../core/content/fixtures';

const lesson = rawLesson();

function step(over: Partial<PlaygroundStep> = {}): PlaygroundStep {
  return {
    type: 'playground',
    id: 'colour-heading',
    concept: 'js.coercion',
    difficulty: 1,
    prompt: 'Make the heading teal.',
    html: '<h1>Pancakes</h1>',
    css: 'h1 { color: black; }',
    checks: [
      { label: 'One heading', selector: 'h1', count: 1, text: 'pancakes' },
      { label: 'The heading is teal', selector: 'h1', style: { property: 'color', value: 'rgb(0, 128, 128)' } },
    ],
    solution: { css: 'h1 { color: teal; }' },
    ...over,
  };
}

const rules = async (over: Partial<PlaygroundStep>) =>
  (await jsdomPlaygroundGate(lesson, step(over))).map((issue) => issue.message);

describe('probePage', () => {
  it('judges a page the way the preview does, computed colours included', async () => {
    const page = await probePage({ html: '<h1>Pancakes</h1>', css: 'h1 { color: teal; }' }, step().checks ?? []);
    expect(page.results.map((r) => r.passed)).toEqual([true, true]);
    expect(page.report.tree[0]).toMatchObject({ tag: 'html' });
  });

  it('runs the JavaScript tab after the HTML, and collects what it throws', async () => {
    const changed = await probePage(
      { html: '<p>a</p>', js: 'document.querySelector("p").textContent = "b";' },
      [{ label: 'b', selector: 'p', text: 'b' }],
    );
    expect(changed.results[0]?.passed).toBe(true);
    const broken = await probePage({ html: '<p>a</p>', js: 'nope();' }, []);
    expect(broken.report.errors[0]).toMatch(/nope/);
  });

  it('keeps scripts in the HTML from running when the step has no JavaScript tab', async () => {
    const page = await probePage(
      { html: '<p>a</p><script>document.querySelector("p").textContent = "b";</script>' },
      [{ label: 'a', selector: 'p', text: 'a' }],
    );
    expect(page.results[0]?.passed).toBe(true);
  });
});

describe('jsdomPlaygroundGate', () => {
  it('passes a solution that meets every check over a starter that does not', async () => {
    expect(await rules({})).toEqual([]);
  });

  it('reports a solution that misses a check, naming it and why', async () => {
    const [message] = await rules({ solution: { css: 'h1 { color: red; }' } });
    expect(message).toMatch(/"The heading is teal": color is rgb\(255, 0, 0\)/);
  });

  it('reports a starter that already passes', async () => {
    expect(await rules({ css: 'h1 { color: teal; }' })).toEqual([
      expect.stringMatching(/starter already passes/),
    ]);
  });

  it('reports a solution whose script throws', async () => {
    const messages = await rules({ js: '', solution: { css: 'h1 { color: teal; }', js: 'boom();' } });
    expect(messages[0]).toMatch(/script throws: .*boom/);
  });

  it('leaves a free playground alone', async () => {
    expect(await rules({ checks: undefined, solution: undefined })).toEqual([]);
  });
});
