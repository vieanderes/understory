import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CompiledTaskGuide } from '@/core/online-test';
import { GuidePanel } from '@/features/online-test/GuidePanel';
import {
  OnlineTestServicesProvider,
  defaultServices,
  type OnlineTestServices,
} from '@/features/online-test/services';

const GUIDE: CompiledTaskGuide = {
  taskId: 't',
  approachHtml: '<p>Use a set.</p>',
  complexity: 'O(N) time',
  steps: [
    { kind: 'read', title: 'Read the assumptions', bodyHtml: '<p>N is large.</p>', minutes: 2 },
    {
      kind: 'ask-ai',
      title: 'Ask one narrow question',
      bodyHtml: '<p>Why.</p>',
      prompt: 'Is N + 1 the largest answer?',
      input: ['[1, 2]', '[-1]'],
      expect: 'The assistant agrees.',
    },
    {
      kind: 'write',
      title: 'Write it',
      bodyHtml: '<p>Five lines.</p>',
      code: {
        ts: 'function solution(A: number[]) {}',
        js: 'function solution(A) {}',
        python: 'def solution(A):\n    pass',
      },
      codeMode: 'full',
    },
    { kind: 'submit', title: 'Submit', bodyHtml: '<p>Done.</p>' },
  ],
};

function services(guide: CompiledTaskGuide | null): OnlineTestServices {
  return { ...defaultServices, loadGuide: () => Promise.resolve(guide) };
}

function Harness(props: {
  guide: CompiledTaskGuide | null;
  onPrompt?: (text: string) => void;
  onUseCode?: (code: string) => void;
  onAddInput?: (lines: readonly string[]) => void;
}) {
  const [step, setStep] = useState(0);
  const [value] = useState(() => services(props.guide));
  return (
    <OnlineTestServicesProvider services={value}>
      <GuidePanel
        taskId="t"
        language="python"
        step={step}
        onStep={setStep}
        onPrompt={props.onPrompt ?? (() => {})}
        onUseCode={props.onUseCode ?? (() => {})}
        onAddInput={props.onAddInput ?? (() => {})}
      />
    </OnlineTestServicesProvider>
  );
}

describe('GuidePanel', () => {
  it('walks the steps with their prompt, test cases and code', async () => {
    const onPrompt = vi.fn();
    const onUseCode = vi.fn();
    const onAddInput = vi.fn();
    const user = userEvent.setup();
    await act(async () => {
      render(
        <Harness guide={GUIDE} onPrompt={onPrompt} onUseCode={onUseCode} onAddInput={onAddInput} />,
      );
    });

    expect(
      await screen.findByRole('heading', { name: 'Read the assumptions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Next step/ }));
    expect(screen.getByText('Is N + 1 the largest answer?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Put in the assistant/ }));
    expect(onPrompt).toHaveBeenCalledWith('Is N + 1 the largest answer?');
    await user.click(screen.getByRole('button', { name: 'Add these cases' }));
    expect(onAddInput).toHaveBeenCalledWith(['[1, 2]', '[-1]']);
    expect(screen.getByText('The assistant agrees.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next step/ }));
    expect(screen.getByLabelText('Guide code')).toHaveTextContent('def solution(A):');
    await user.click(screen.getByRole('button', { name: 'Use this code' }));
    await user.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(onUseCode).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Use this code' }));
    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onUseCode).toHaveBeenCalledWith('def solution(A):\n    pass');

    await user.click(screen.getByRole('button', { name: 'Step 4: Submit' }));
    expect(screen.getByRole('button', { name: /Next step/ })).toBeDisabled();
  });

  it('says so when a task has no guide', async () => {
    await act(async () => {
      render(<Harness guide={null} />);
    });
    expect(await screen.findByText(/This task has no guide yet/)).toBeInTheDocument();
  });
});
