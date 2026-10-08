import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledMultipleChoiceStep } from '@/core/content/compiled';
import { ChoiceStep } from '@/features/lesson-player/steps/ChoiceStep';
import { setTutorOpen, takeQueuedQuestion } from '@/features/tutor/tutor-store';
import { choice, renderStep, rich } from './fixtures';

vi.mock('next/navigation', () => ({ usePathname: () => '/learn/javascript/closures' }));

const step: CompiledMultipleChoiceStep = {
  type: 'multiple-choice',
  id: 'q1',
  concept: 'js.closures',
  difficulty: 2,
  question: rich('What does the counter print the second time?'),
  choices: [
    choice('2', 'The closure keeps the binding.', true),
    choice('1', 'A copy is not taken: the inner function keeps the binding.'),
  ],
} as CompiledMultipleChoiceStep;

describe('ChoiceStep and Scout', () => {
  beforeEach(() => {
    takeQueuedQuestion();
  });
  afterEach(() => act(() => setTutorOpen(false, { remember: false })));

  it('offers Scout after a wrong pick, sending the task, the pick and the lesson’s feedback', async () => {
    const user = userEvent.setup();
    renderStep(ChoiceStep, step);
    await user.click(screen.getByRole('radio', { name: /^1/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Ask Scout why' }));
    const question = takeQueuedQuestion();
    expect(question).toContain('What does the counter print the second time?');
    expect(question).toContain('I picked:\n> 1');
    expect(question).toContain('A copy is not taken');
  });

  it('does not offer it after a right pick', async () => {
    const user = userEvent.setup();
    renderStep(ChoiceStep, step);
    await user.click(screen.getByRole('radio', { name: /^2/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.queryByRole('button', { name: 'Ask Scout why' })).not.toBeInTheDocument();
  });
});
