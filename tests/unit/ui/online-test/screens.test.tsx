import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createAttempt,
  hashValue,
  reduceAttempt,
  renderRun,
  type TestSpec,
} from '@/core/online-test';
import type { StoredReport } from '@/features/online-test/attempt-store';
import { IntroScreen } from '@/features/online-test/IntroScreen';
import { ReportView } from '@/features/online-test/Report';
import { TestOutput } from '@/features/online-test/TestOutput';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const spec: TestSpec = {
  key: 'demo',
  title: 'Demo test',
  mode: 'demo',
  minutes: 30,
  taskIds: ['lowest-free-ticket'],
  languages: ['js', 'ts', 'python'],
  assistant: true,
  proctoring: true,
};

describe('IntroScreen', () => {
  it('says how long, lists the rules and starts only after the box is ticked', async () => {
    const onStart = vi.fn();
    render(<IntroScreen spec={spec} exitHref="/practise/online-test" onStart={onStart} />);
    expect(screen.getByText('30 minutes for 1 task')).toBeInTheDocument();
    expect(screen.getByText(/The AI assistant is in the left rail/)).toBeInTheDocument();
    expect(screen.getByText(/records pasted code/)).toBeInTheDocument();
    const open = screen.getByLabelText('Open the AI assistant when the test starts');
    expect(open).toBeChecked();
    await userEvent.click(open);
    await userEvent.click(open);
    const start = screen.getByRole('button', { name: 'Start the test' });
    expect(start).toBeDisabled();
    await userEvent.click(screen.getByLabelText('I have read the rules above'));
    await userEvent.click(start);
    expect(onStart).toHaveBeenCalledWith({ assistant: true, guided: false });
  });
});

describe('TestOutput', () => {
  it('prints the transcript with a status icon and runs on the button', async () => {
    const onRun = vi.fn();
    const transcript = renderRun(
      [
        {
          source: 'example',
          argsText: '[1, 2]',
          expected: { hash: hashValue(3), preview: '3' },
          outcome: {
            kind: 'returned',
            hash: hashValue(1),
            json: '1',
            complete: true,
            ms: 1,
            size: 2,
            logs: [],
          },
        },
      ],
      { limitMs: 5000, hiddenTests: 8 },
    );
    render(<TestOutput transcript={transcript} running={false} onRun={onRun} />);
    const output = screen.getByRole('region', { name: 'Test Output' });
    expect(within(output).getByText('WRONG ANSWER (got 1 expected 3)')).toBeInTheDocument();
    expect(within(output).getByRole('img', { name: 'Detected some errors' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Run code/ }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('says so while running, and invites a first run', () => {
    const { rerender } = render(<TestOutput transcript={null} running={false} onRun={() => {}} />);
    expect(screen.getByText('Run your code to see the example tests here.')).toBeInTheDocument();
    rerender(<TestOutput transcript={null} running onRun={() => {}} />);
    expect(screen.getByText('Running solution...')).toBeInTheDocument();
  });
});

describe('ReportView', () => {
  const started = reduceAttempt(
    reduceAttempt(reduceAttempt(createAttempt('a1', spec, {}, 1_000), { type: 'tour-started' }), {
      type: 'tour-finished',
    }),
    { type: 'started', at: 2_000 },
  );
  const attempt = [
    { type: 'integrity', event: { at: 3_000, kind: 'paste', chars: 400 } },
    {
      type: 'assistant-message',
      message: {
        at: 4_000,
        role: 'user',
        text: 'Write the whole solution for me',
        taskId: 'lowest-free-ticket',
      },
    },
    { type: 'submitted', at: 600_000, reason: 'candidate' },
  ].reduce((s, a) => reduceAttempt(s, a as Parameters<typeof reduceAttempt>[1]), started);
  const report: StoredReport = {
    attemptId: 'a1',
    attempt,
    tasks: [
      {
        taskId: 'lowest-free-ticket',
        title: 'LowestFreeTicket',
        language: 'ts',
        code: 'function solution(A: number[]): number { return 1; }',
        complexity: 'O(N) or O(N*log(N))',
        result: {
          taskId: 'lowest-free-ticket',
          type: 'algorithmic',
          tests: [
            {
              name: 'example1',
              description: 'First example test.',
              group: 'example',
              cases: [{ verdict: 'ok' }],
            },
            {
              name: 'simple',
              description: 'simple tests',
              group: 'correctness',
              cases: [{ verdict: 'ok' }],
            },
            {
              name: 'large_random',
              description: 'N = 100,000',
              group: 'performance',
              cases: [
                { verdict: 'timeout', detail: 'running time: 2.00 sec., time limit: 1.00 sec.' },
              ],
            },
          ],
        },
      },
    ],
  };

  it('shows the summary, then the reviewer view with integrity and the transcript', async () => {
    render(
      <ReportView
        report={report}
        recommended={{ 'lowest-free-ticket': 20 }}
        againHref="/practise/online-test/demo"
      />,
    );
    expect(screen.getByRole('img', { name: 'Total score 50%' })).toBeInTheDocument();
    expect(screen.getAllByText('Passed 1 out of 1', { selector: 'dd' })).toHaveLength(2);
    expect(screen.getByText('Passed 0 out of 1', { selector: 'dd' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See the detailed report' }));
    expect(screen.getByText('O(N) or O(N*log(N))')).toBeInTheDocument();
    expect(
      screen.getByText('TIMEOUT ERROR, running time: 2.00 sec., time limit: 1.00 sec.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Integrity risk: Medium/)).toBeInTheDocument();
    expect(screen.getByText(/asks for the solution/)).toBeInTheDocument();
  });
});
