import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompiledPlaygroundStep } from '@/core/content/compiled';
import type { Grade } from '@/core/grading';
import { PLAYGROUND_MESSAGE_SOURCE, type ProbeReport } from '@/core/playground';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';
import type { Submission } from '@/features/lesson-player/contract';
import { PlaygroundStep } from '@/features/lesson-player/steps/PlaygroundStep';

vi.mock('@/features/editor/LazyCodeEditor', () => ({
  // The header row (file tabs, Reset) is drawn by the editor, so the stand-in draws it too.
  LazyCodeEditor: ({
    value,
    onChange,
    readOnly,
    ariaLabel,
    language,
    header,
  }: LazyCodeEditorProps) => (
    <>
      {header}
      <textarea
        aria-label={ariaLabel}
        data-language={language}
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </>
  ),
}));

// React's text is a fetch from the app origin; here a marker stands in for it.
vi.mock('@/adapters/sandbox/runtime-loader', () => ({
  loadPlaygroundReact: () => Promise.resolve('/* the React runtime */'),
}));

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const COUNTER = `import { useState } from 'react';
export default function App() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count)}>{count}</button>;
}
`;

const STEP: CompiledPlaygroundStep = {
  type: 'playground',
  id: 'fix-counter',
  concept: 'react.state',
  difficulty: 2,
  prompt: rich('Make the button count.'),
  jsx: COUNTER,
  editable: ['jsx'],
  checks: [
    { label: 'One button', selector: 'button', count: 1 },
    {
      label: 'Two clicks show 2',
      actions: [{ click: 'button' }, { click: 'button' }],
      selector: 'button',
      text: '2',
    },
  ],
  solution: { jsx: COUNTER.replace('setCount(count)', 'setCount(count + 1)') },
};

const frame = () => screen.getByTitle('Your page') as HTMLIFrameElement;

function post(data: ProbeReport) {
  const iframe = frame();
  const nonce = /var nonce = "([A-Za-z0-9]+)"/.exec(iframe.getAttribute('srcdoc') ?? '')?.[1];
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: PLAYGROUND_MESSAGE_SOURCE, nonce, report: data },
        source: iframe.contentWindow,
      }),
    );
  });
}

const report = (over: Partial<ProbeReport> = {}): ProbeReport => ({
  facts: [{ count: 1 }, { count: 1, text: '0' }],
  tree: [],
  truncated: false,
  errors: [],
  ...over,
});

function setup(props: { phase?: 'answering' | 'checked'; grade?: Grade; reveal?: boolean } = {}) {
  const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
  render(
    <PlaygroundStep
      step={STEP}
      phase={props.phase ?? 'answering'}
      grade={props.grade}
      reveal={props.reveal ?? false}
      seed={1}
      lessonId="react.test"
      onSubmissionChange={onSubmissionChange}
      requestCheck={vi.fn()}
    />,
  );
  return { onSubmissionChange };
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe('a React playground', () => {
  it('waits for React, then renders the transpiled component in the sandboxed page', async () => {
    setup();
    expect(await screen.findByTitle('Your page')).toHaveAttribute('sandbox', 'allow-scripts');
    const doc = frame().getAttribute('srcdoc') ?? '';
    expect(doc).toContain('/* the React runtime */');
    expect(doc).toContain('<div id="root"></div>');
    // Sucrase ran: JSX became calls, and the import a require the page answers.
    expect(doc).toContain("require('react')");
    expect(doc).not.toContain('<button onClick');
  });

  it('edits the component in a tab of its own, with the TSX grammar', async () => {
    setup();
    await screen.findByTitle('Your page');
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Component of your page' })).toHaveAttribute(
      'data-language',
      'tsx',
    );
  });

  it('grades the actions check from the frame report', async () => {
    const { onSubmissionChange } = setup();
    await screen.findByTitle('Your page');
    post(report());
    expect(screen.getByText('1 of 2 pass')).toBeInTheDocument();
    expect(onSubmissionChange).toHaveBeenLastCalledWith({
      type: 'playground',
      results: [
        { passed: true },
        { passed: false, reason: 'The first "button" reads "0". It needs "2".' },
      ],
      hintsUsed: 0,
    });
  });

  it('says when the component stopped, and what React warns about', async () => {
    setup();
    await screen.findByTitle('Your page');
    post(
      report({
        errors: ['TypeError: items is undefined (line 3)'],
        warnings: ['Each child in a list should have a unique "key" prop.'],
      }),
    );
    expect(
      screen.getByText('Your component stopped: TypeError: items is undefined (line 3)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/React warns: Each child in a list/)).toBeInTheDocument();
  });

  it('shows the solution component and its own render after a wrong check', async () => {
    const grade: Grade = { correct: false, score: 0.5, feedback: [] };
    setup({ phase: 'checked', grade, reveal: true });
    expect(await screen.findByTitle('The solution page')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Component of the solution' })).toHaveValue(
      STEP.solution?.jsx,
    );
  });

  it('redraws after an edit', async () => {
    setup();
    await screen.findByTitle('Your page');
    const editor = screen.getByRole('textbox', { name: 'Component of your page' });
    await userEvent.clear(editor);
    await userEvent.type(editor, 'export default function App() {{ return <p>Hi</p>; }');
    await vi.waitFor(() => expect(frame().getAttribute('srcdoc')).toContain('"Hi"'));
  });
});
