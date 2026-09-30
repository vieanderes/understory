import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompiledPlaygroundStep } from '@/core/content/compiled';
import type { Grade } from '@/core/grading';
import { PLAYGROUND_MESSAGE_SOURCE, type ProbeReport } from '@/core/playground';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';
import type { Submission } from '@/features/lesson-player/contract';
import { PlaygroundStep } from '@/features/lesson-player/steps/PlaygroundStep';

// The editor is a plain field here; CodeMirror has its own tests and the e2e suite.
vi.mock('@/features/editor/LazyCodeEditor', () => ({
  // The header row (file tabs, Reset) is drawn by the editor, so the stand-in draws it too.
  LazyCodeEditor: ({ value, onChange, readOnly, ariaLabel, header }: LazyCodeEditorProps) => (
    <>
      {header}
      <textarea
        aria-label={ariaLabel}
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </>
  ),
}));

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const STEP: CompiledPlaygroundStep = {
  type: 'playground',
  id: 'build-heading',
  concept: 'html.elements',
  difficulty: 1,
  prompt: rich('Add an h2.'),
  html: '<h1>Pancakes</h1>\n',
  css: 'h1 { color: teal; }\n',
  editable: ['html'],
  showTree: true,
  checks: [
    { label: 'One `h2`', selector: 'h2', count: 1 },
    { label: 'It says Ingredients', selector: 'h2', text: 'Ingredients' },
  ],
  solution: { html: '<h1>Pancakes</h1>\n<h2>Ingredients</h2>\n' },
  hints: [rich('Hint one'), rich('Hint two')],
};

const report = (facts: ProbeReport['facts'], over: Partial<ProbeReport> = {}): ProbeReport => ({
  facts,
  tree: [
    { depth: 0, kind: 'element', tag: 'html', attrs: [{ name: 'lang', value: 'en' }] },
    { depth: 1, kind: 'element', tag: 'body', attrs: [] },
    { depth: 2, kind: 'element', tag: 'h1', attrs: [] },
    { depth: 3, kind: 'text', text: 'Pancakes' },
  ],
  truncated: false,
  errors: [],
  ...over,
});

function frame(): HTMLIFrameElement {
  return screen.getByTitle('Your page') as HTMLIFrameElement;
}

/** What the probe inside the frame would post, sent as if from that frame. */
function post(data: ProbeReport, nonce?: string) {
  const iframe = frame();
  const doc = iframe.getAttribute('srcdoc') ?? '';
  const current = nonce ?? /var nonce = "([A-Za-z0-9]+)"/.exec(doc)?.[1] ?? '';
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: PLAYGROUND_MESSAGE_SOURCE, nonce: current, report: data },
        source: iframe.contentWindow,
      }),
    );
  });
}

function setup(
  props: {
    step?: CompiledPlaygroundStep;
    phase?: 'answering' | 'checked';
    grade?: Grade;
    reveal?: boolean;
  } = {},
) {
  const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
  const view = render(
    <PlaygroundStep
      step={props.step ?? STEP}
      phase={props.phase ?? 'answering'}
      grade={props.grade}
      reveal={props.reveal ?? false}
      seed={1}
      lessonId="html.test"
      onSubmissionChange={onSubmissionChange}
      requestCheck={vi.fn()}
    />,
  );
  return { onSubmissionChange, ...view };
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe('PlaygroundStep', () => {
  it('renders the starter as a sandboxed page with only scripts allowed', () => {
    setup();
    const iframe = frame();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Pancakes</h1>');
    expect(iframe.getAttribute('srcdoc')).toContain('h1 { color: teal; }');
  });

  it('ticks the checklist from the frame report and hands the results to the player', () => {
    const { onSubmissionChange } = setup();
    expect(screen.getByText('Waiting for the page')).toBeInTheDocument();
    post(report([{ count: 1 }, { count: 1, text: 'Ingredients' }]));
    expect(screen.getByText('2 of 2 pass')).toBeInTheDocument();
    expect(onSubmissionChange).toHaveBeenLastCalledWith({
      type: 'playground',
      results: [{ passed: true }, { passed: true }],
      hintsUsed: 0,
    });
  });

  it('ignores a report from anywhere but its frame, or for an older page', () => {
    const { onSubmissionChange } = setup();
    post(report([{ count: 1 }, { count: 1 }]), 'stale1');
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: PLAYGROUND_MESSAGE_SOURCE, nonce: 'x', report: report([]) },
          source: window,
        }),
      );
    });
    expect(onSubmissionChange).not.toHaveBeenCalled();
    expect(screen.getByText('Waiting for the page')).toBeInTheDocument();
  });

  it('redraws the page a moment after typing, and keeps the edit as a draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    const editor = screen.getByRole('textbox', { name: 'HTML of your page' });
    await user.type(editor, '<h2>Ingredients</h2>');
    expect(frame().getAttribute('srcdoc')).not.toContain('<h2>Ingredients</h2>');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(frame().getAttribute('srcdoc')).toContain('<h2>Ingredients</h2>');
    expect(window.sessionStorage.getItem('understory:draft:html.test#build-heading')).toContain(
      'Ingredients',
    );
  });

  it('shows the CSS read only when only the HTML is editable', async () => {
    setup();
    await userEvent.click(screen.getByLabelText('CSS'));
    const css = screen.getByRole('textbox', { name: 'CSS of your page, read only' });
    expect(css).toHaveAttribute('readonly');
    expect(screen.getByText('Read only in this step')).toBeInTheDocument();
  });

  it('draws the DOM tree the frame reports', () => {
    setup();
    post(report([{ count: 0 }, { count: 0 }]));
    const tree = screen.getByTestId('dom-tree');
    expect(within(tree).getAllByRole('listitem')).toHaveLength(4);
    expect(tree).toHaveTextContent('"Pancakes"');
    expect(tree).toHaveTextContent('lang="en"');
  });

  it('says so when the learner script throws', () => {
    setup();
    post(report([{ count: 0 }, { count: 0 }], { errors: ['x is not defined (line 2)'] }));
    expect(
      screen.getByText(/Your script stopped: x is not defined \(line 2\)/),
    ).toBeInTheDocument();
  });

  it('carries hints into the answer already reported', async () => {
    const { onSubmissionChange } = setup();
    post(report([{ count: 0 }, { count: 0 }]));
    await userEvent.click(screen.getByRole('button', { name: 'Hint 1 of 2' }));
    expect(onSubmissionChange).toHaveBeenLastCalledWith(expect.objectContaining({ hintsUsed: 1 }));
  });

  it('restores the starter after a confirmation', async () => {
    setup();
    const editor = screen.getByRole('textbox', { name: 'HTML of your page' });
    await userEvent.type(editor, 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByRole('textbox', { name: 'HTML of your page' })).toHaveValue(STEP.html);
  });

  it('explains open checks after a wrong check, and shows the solution once revealed', () => {
    const grade: Grade = { correct: false, score: 0.5, feedback: [] };
    setup({ phase: 'checked', grade, reveal: true });
    post(report([{ count: 1 }, { count: 1, text: 'Waffles' }]));
    expect(
      screen.getByText('1 of 2 checks pass. The open ones say what is missing.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/reads "Waffles"/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'HTML of the solution' })).toHaveValue(
      STEP.solution?.html,
    );
    expect(screen.getByTitle('The solution page')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'HTML of your page' })).toHaveAttribute('readonly');
  });

  it('is a plain sandbox without checks: no checklist, no answer', () => {
    const { onSubmissionChange } = setup({
      step: { ...STEP, checks: undefined, solution: undefined, hints: undefined, showTree: false },
    });
    post(report([]));
    expect(screen.queryByText('Checks')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dom-tree')).not.toBeInTheDocument();
    expect(onSubmissionChange).not.toHaveBeenCalled();
  });

  it('restores a draft on the next visit', () => {
    window.sessionStorage.setItem(
      'understory:draft:html.test#build-heading',
      JSON.stringify({ html: '<h2>Saved</h2>', css: 'ignored' }),
    );
    setup();
    expect(screen.getByRole('textbox', { name: 'HTML of your page' })).toHaveValue(
      '<h2>Saved</h2>',
    );
    expect(frame().getAttribute('srcdoc')).toContain('h1 { color: teal; }');
  });
});
