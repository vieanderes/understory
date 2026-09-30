import { describe, expect, it } from 'vitest';
import { jsdomPlaygroundGate, probePage } from '../../../../scripts/lib/playground-gate';
import type { PlaygroundStep } from '@/core/content/schema';
import { rawLesson } from '../../core/content/fixtures';

/*
 * A React playground in the gate: the committed React runtime, the sucrase transform and
 * the frame script, all run in jsdom. These tests are the frame script's own too, since
 * the preview runs the same page in a browser.
 */

const COUNTER = `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <p>Clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>Add one</button>
    </>
  );
}
`;

const BROKEN_COUNTER = COUNTER.replace('setCount(count + 1)', 'count + 1');

const TWO_CLICKS = {
  label: 'Two clicks show 2',
  actions: [{ click: 'button' }, { click: 'button' }],
  selector: 'p',
  text: 'Clicked 2 times',
};

describe('a React page in the gate', () => {
  it('renders the default export into #root, with state, and the tree shows it', async () => {
    const page = await probePage({ jsx: COUNTER }, [
      { label: 'Starts at 0', selector: '#root p', text: 'Clicked 0 times' },
    ]);
    expect(page.report.errors).toEqual([]);
    expect(page.results[0]?.passed).toBe(true);
    const tags = page.report.tree.flatMap((row) => (row.kind === 'element' ? [row.tag] : []));
    expect(tags).toEqual(['html', 'head', 'body', 'div', 'p', 'button']);
  });

  it('plays a check’s clicks on a fresh render, so checks do not leak into each other', async () => {
    const page = await probePage({ jsx: COUNTER }, [
      TWO_CLICKS,
      { label: 'Still 0 without clicks', selector: 'p', text: 'Clicked 0 times' },
      { ...TWO_CLICKS, label: 'Two again' },
    ]);
    expect(page.results.map((r) => r.passed)).toEqual([true, true, true]);
  });

  it('shows the learner the untouched render once the checks are done', async () => {
    const page = await probePage({ jsx: COUNTER }, [TWO_CLICKS]);
    // React writes each part of `Clicked {count} times` as a text node of its own.
    expect(page.report.tree).toContainEqual({ depth: 4, kind: 'text', text: '0' });
    // The veil over the check renders is gone, and was never part of the tree.
    expect(page.report.tree.some((row) => row.kind === 'element' && row.tag === 'style')).toBe(false);
  });

  it('fails a click check on a counter that does not count', async () => {
    const page = await probePage({ jsx: BROKEN_COUNTER }, [TWO_CLICKS]);
    expect(page.results[0]).toEqual({
      passed: false,
      reason: 'The first "p" reads "Clicked 0 times". It needs "Clicked 2 times".',
    });
  });

  it('types into a controlled field one key at a time', async () => {
    const jsx = `import { useState } from 'react';
export default function App() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); setItems([...items, draft]); setDraft(''); }}>
      <input aria-label="Task" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button>Add</button>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </form>
  );
}
`;
    const page = await probePage({ jsx }, [
      {
        label: 'Adding a task lists it',
        actions: [{ type: 'Buy milk', into: 'input' }, { click: 'button' }],
        selector: 'li',
        count: 1,
        text: 'Buy milk',
      },
      { label: 'Nothing to click', actions: [{ click: 'a' }], selector: 'li' },
    ]);
    expect(page.report.errors).toEqual([]);
    expect(page.results[0]).toEqual({ passed: true });
    expect(page.results[1]).toEqual({ passed: false, reason: 'Nothing matches "a" to click.' });
  });

  it('reports a render error with the learner’s line', async () => {
    const jsx = `export default function App() {
  const items = undefined;
  return <p>{items.length}</p>;
}
`;
    const page = await probePage({ jsx }, []);
    expect(page.report.errors[0]).toMatch(/^TypeError: .*length/);
  });

  it('reports a syntax error with its line, and renders nothing', async () => {
    const page = await probePage({ jsx: 'export default function App() {\n  return <p>Hi</p\n}\n' }, [
      { label: 'A paragraph', selector: 'p' },
    ]);
    expect(page.report.errors[0]).toMatch(/^SyntaxError: .*\(line \d\)$/);
    expect(page.results[0]?.passed).toBe(false);
  });

  it('asks for a default export, and allows only React to be imported', async () => {
    const none = await probePage({ jsx: 'export function Card() { return null; }' }, []);
    expect(none.report.errors).toEqual([
      'Error: Nothing to render. The file needs export default function App().',
    ]);
    const other = await probePage(
      { jsx: "import _ from 'lodash';\nexport default function App() { return _.x; }" },
      [],
    );
    // jsdom's stacks do not carry page lines; the browser's do (tests/e2e/react-playground.spec.ts).
    expect(other.report.errors[0]).toMatch(/^Error: Only React can be imported here, not "lodash"\./);
  });

  it('passes on React’s warning about a list without keys', async () => {
    const jsx = `export default function App() {
  return <ul>{['a', 'b'].map((x) => <li>{x}</li>)}</ul>;
}
`;
    const page = await probePage({ jsx }, []);
    expect(page.report.warnings?.[0]).toMatch(/unique "key" prop/);
  });
});

const lesson = rawLesson();

function step(over: Partial<PlaygroundStep> = {}): PlaygroundStep {
  return {
    type: 'playground',
    id: 'fix-counter',
    concept: 'js.coercion',
    difficulty: 2,
    prompt: 'Make the button count.',
    jsx: BROKEN_COUNTER,
    checks: [TWO_CLICKS],
    solution: { jsx: COUNTER },
    ...over,
  };
}

describe('the gate on a React playground', () => {
  it('passes a solution that counts over a starter that does not', async () => {
    expect(await jsdomPlaygroundGate(lesson, step())).toEqual([]);
  });

  it('reports a solution React warns about', async () => {
    const warned = COUNTER.replace('<p>', '<ul>{[1, 2].map((n) => <li>{n}</li>)}</ul><p>');
    const issues = await jsdomPlaygroundGate(lesson, step({ solution: { jsx: warned } }));
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringMatching(/^React warns about the solution: .*key/),
    ]);
  });
});
