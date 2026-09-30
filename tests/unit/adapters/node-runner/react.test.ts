import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeWorkerRunner } from '@/adapters/node-runner/worker-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import type { RunResult } from '@/core/ports/code-runner';
import { createChallengeChecker } from '../../../../scripts/lib/node-solution-gate';

/*
 * tsx challenges in the Node gate: the committed React runtime, the same harness and the
 * same transpiler as the browser. The fixture is an accessible autocomplete, written the
 * way a lesson would be, and independent of any lesson.
 */

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/react-challenge');
const read = (name: string): string => readFileSync(path.join(FIXTURE, name), 'utf8');

async function runTsx(code: string, tests: string): Promise<RunResult> {
  const runner = new NodeWorkerRunner(await loadTranspiler());
  return runner.run({
    runId: 'react-unit',
    language: 'tsx',
    code,
    tests,
    timeoutMs: 10_000,
    harnessVersion: 1,
  });
}

describe('tsx runs in the Node runner', () => {
  it('passes the reference component', async () => {
    const result = await runTsx(read('solution.tsx'), read('tests.tsx'));
    expect(result.tests.filter((test) => !test.passed)).toEqual([]);
    expect(result.status).toBe('passed');
    expect(result.tests).toHaveLength(4);
  });

  it('fails the starter with Testing Library messages', async () => {
    const result = await runTsx(read('starter.tsx'), read('tests.tsx'));
    expect(result.status).toBe('failed');
    expect(result.tests[0]?.message).toContain(
      'Unable to find an accessible element with the role "combobox"',
    );
  });

  it('passes the solution and fails the starter in the solution gate', async () => {
    const check = createChallengeChecker({ timeoutMs: 10_000 });
    const issues = await check({
      lessonPath: 'fixture/lesson.yaml',
      stepId: 'autocomplete',
      language: 'tsx',
      starter: read('starter.tsx'),
      solution: read('solution.tsx'),
      tests: read('tests.tsx'),
    });
    expect(issues).toEqual([]);
  });

  it('starts every test on an empty page and fails the test whose handler throws', async () => {
    const result = await runTsx(
      `export function Boom() {
  return <button onClick={() => { throw new Error('handler broke'); }}>Boom</button>;
}`,
      `import { render, screen, fireEvent } from '@testing-library/react';
import { Boom } from './solution';
test('throws', () => {
  render(<Boom />);
  fireEvent.click(screen.getByRole('button'));
});
test('clean page', () => {
  expect(document.body.children).toHaveLength(0);
  render(<Boom />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
});`,
    );
    expect(result.tests).toEqual([
      { name: 'throws', passed: false, message: 'Error: handler broke' },
      { name: 'clean page', passed: true },
    ]);
  });

  it('shows React warnings in the output, with their placeholders filled', async () => {
    const result = await runTsx(
      `export const List = () => <ul>{['a', 'b'].map((item) => <li>{item}</li>)}</ul>;`,
      `import { render, screen } from '@testing-library/react';
import { List } from './solution';
test('renders', () => { render(<List />); expect(screen.getAllByRole('listitem')).toHaveLength(2); });`,
    );
    expect(result.status).toBe('passed');
    expect(result.logs.join('\n')).toContain(
      'Each child in a list should have a unique "key" prop',
    );
    expect(result.logs.join('\n')).not.toContain('%s');
  });

  it('reports a runtime error in a component with the line the learner wrote', async () => {
    const result = await runTsx(
      `type Props = { items: string[] };\n\nexport function Count({ items }: Props) {\n  const first = items[0]!;\n  return <p>{first.length}</p>;\n}\nconst broken: string[] = null as never;\nbroken.length;`,
      `test('t', () => {});`,
    );
    expect(result.status).toBe('error');
    expect(result.error).toMatchObject({ name: 'TypeError', line: 8 });
  });

  it('turns broken JSX into a SyntaxError, not a crash', async () => {
    // Sucrase does not match closing tags, so the line it gives can be earlier than the
    // mistake. docs/SANDBOX.md lists this among the limits.
    const result = await runTsx(
      `export const A = () => (\n  <div>\n    <p>\n  </div>\n);`,
      `test('t', () => {});`,
    );
    expect(result.status).toBe('error');
    expect(result.error?.name).toBe('SyntaxError');
  });

  it('runs a React form action, which reads the form through FormData', async () => {
    const code = `import { useActionState } from 'react';
export function Signup() {
  const [message, submit] = useActionState((_prev: string, data: FormData) => {
    const email = String(data.get('email') ?? '');
    const topics = data.getAll('topic').join(', ');
    return email.includes('@') ? 'Welcome ' + email + ' (' + topics + ')' : 'Enter an email';
  }, '');
  return (
    <form action={submit}>
      <label>Email <input name="email" /></label>
      <label><input type="checkbox" name="topic" value="news" defaultChecked /> News</label>
      <label><input type="checkbox" name="topic" value="tips" /> Tips</label>
      <label><input type="checkbox" name="topic" value="jobs" defaultChecked disabled /> Jobs</label>
      <button>Sign up</button>
      <p role="status">{message}</p>
    </form>
  );
}`;
    const tests = `import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Signup } from './solution';

test('submits the fields through the action', async () => {
  const user = userEvent.setup();
  render(<Signup />);
  await user.type(screen.getByLabelText('Email'), 'ada@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(await screen.findByText('Welcome ada@example.com (news)')).toBeInTheDocument();
});

test('FormData works on its own too', () => {
  const data = new FormData();
  data.append('a', '1');
  data.append('a', '2');
  data.set('b', '3');
  expect(data.getAll('a')).toEqual(['1', '2']);
  expect([...data.keys()]).toEqual(['a', 'a', 'b']);
  expect(data.has('c')).toBe(false);
});`;
    const result = await runTsx(code, tests);
    expect(result.tests.filter((test) => !test.passed)).toEqual([]);
    expect(result.status).toBe('passed');
  });

  it('awaits act with an async callback', async () => {
    const code = `import { useEffect, useState } from 'react';
export function Later({ load }: { load: () => Promise<string> }) {
  const [text, setText] = useState('Loading');
  useEffect(() => {
    void load().then(setText);
  }, [load]);
  return <p>{text}</p>;
}`;
    const tests = `import { act, render, screen } from '@testing-library/react';
import { Later } from './solution';

test('shows the loaded text', async () => {
  let resolve: (value: string) => void = () => undefined;
  const load = () => new Promise<string>((done) => { resolve = done; });
  render(<Later load={load} />);
  expect(screen.getByText('Loading')).toBeInTheDocument();
  await act(async () => { resolve('Ready'); });
  expect(screen.getByText('Ready')).toBeInTheDocument();
});`;
    const result = await runTsx(code, tests);
    expect(result.tests.filter((test) => !test.passed)).toEqual([]);
    expect(result.status).toBe('passed');
  });
});
