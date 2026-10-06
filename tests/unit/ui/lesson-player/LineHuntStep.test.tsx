import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LineHuntStep } from '@/features/lesson-player/steps/LineHuntStep';
import { aiReviewStep, bugHuntStep, choice, renderStep, rich, twoLineHuntStep } from './fixtures';

const line = (n: number) => screen.getByRole('button', { name: new RegExp(`^Line ${n}:`) });
const reason = (name: RegExp) => screen.getByRole('radio', { name });

describe('LineHuntStep', () => {
  it('asks for the line first and holds the reasons back until one is picked', async () => {
    const user = userEvent.setup();
    renderStep(LineHuntStep, bugHuntStep);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 1 line picked')).toBeInTheDocument();
    await user.click(line(3));
    expect(line(3)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Why is it at fault' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('reports lines and reason, which the real grader accepts', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, bugHuntStep);
    await user.click(line(3));
    expect(view.submission()).toBeNull();
    await user.click(reason(/NaN == false/));
    expect(view.submission()).toEqual({ type: 'bug-hunt', lines: [3], reasonIndex: 0 });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
  });

  it('replaces the oldest pick when the allowed count is reached', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, twoLineHuntStep);
    await user.click(line(1));
    await user.click(line(3));
    await user.click(reason(/NaN == false/));
    await user.click(line(6));
    expect(line(1)).toHaveAttribute('aria-pressed', 'false');
    expect(view.submission()).toEqual({ type: 'bug-hunt', lines: [3, 6], reasonIndex: 0 });
    // Unpicking leaves the answer one line short.
    await user.click(line(6));
    expect(view.submission()).toBeNull();
  });

  it('picks a line from the keyboard', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, bugHuntStep);
    line(3).focus();
    await user.keyboard('{Enter}');
    reason(/Number throws/).focus();
    await user.keyboard(' ');
    expect(view.submission()).toEqual({ type: 'bug-hunt', lines: [3], reasonIndex: 1 });
  });

  it('with a second try on offer, marks the picked line and names the misconception only', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, bugHuntStep, { reveal: false });
    await user.click(line(3));
    await user.click(reason(/Number throws/));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.score).toBe(0.5);
    expect(view.container.querySelector('.line[data-line="3"]')).toHaveAttribute(
      'data-verdict',
      'right',
    );
    // Checked lines are no longer controls.
    expect(screen.queryByRole('button', { name: /^Line 3/ })).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Partly right');
    expect(status).toHaveTextContent('Line 3: right. The reason is not.');
    expect(status).toHaveTextContent('Number never throws on text.');
    expect(screen.queryByText('A fix')).not.toBeInTheDocument();
    expect(screen.queryByText('Right')).not.toBeInTheDocument();
  });

  it('keeps the right reason’s explanation back while the line is still wrong', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, bugHuntStep, { reveal: false });
    await user.click(line(6));
    await user.click(reason(/NaN == false/));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Line 6: not at fault.');
    expect(status).not.toHaveTextContent('NaN equals nothing');
    expect(status).not.toHaveTextContent('Line 3');
    expect(view.container.querySelector('.line[data-line="6"]')).toHaveAttribute(
      'data-verdict',
      'wrong',
    );
    expect(view.container.querySelector('.line[data-line="3"]')).not.toHaveAttribute(
      'data-verdict',
    );
  });

  it('once the attempt is over, marks the true line and shows the feedback and a fix', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, bugHuntStep, { reveal: true });
    await user.click(line(6));
    await user.click(reason(/NaN == false/));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.container.querySelector('.line[data-line="3"]')).toHaveAttribute(
      'data-verdict',
      'right',
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('The fault is on line 3.');
    expect(status).toHaveTextContent('NaN equals nothing');
    expect(
      within(screen.getByRole('group', { name: 'A fix' })).getByText(/isInteger/),
    ).toBeVisible();
  });

  it('ai-review shows the request from the start and the flaw class only at the end', async () => {
    const user = userEvent.setup();
    const view = renderStep(LineHuntStep, aiReviewStep, { reveal: true });
    expect(screen.getByText('Asked of the assistant')).toBeInTheDocument();
    expect(screen.getByText('parseInt').tagName).toBe('CODE');
    expect(screen.queryByText(/Flaw class/)).not.toBeInTheDocument();
    await user.click(line(3));
    await user.click(reason(/NaN == false/));
    expect(view.submission()).toEqual({ type: 'ai-review', lines: [3], reasonIndex: 0 });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(screen.getByText('Flaw class · Edge case')).toBeInTheDocument();
  });

  it('ai-review keeps the flaw class back while a second try is on offer', async () => {
    const user = userEvent.setup();
    renderStep(LineHuntStep, aiReviewStep, { reveal: false });
    await user.click(line(1));
    await user.click(reason(/Number throws/));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.queryByText(/Flaw class/)).not.toBeInTheDocument();
  });

  describe('with a verify follow-up', () => {
    const step = {
      ...bugHuntStep,
      verify: {
        question: rich('Which input proves the fix?'),
        choices: [
          choice('The text "abc"', 'It turns into NaN, the case the check missed.', true),
          choice('The text "2"', 'A valid number passes before and after the fix.'),
        ],
      },
    };

    it('asks the verify question once a reason is picked, and reports all three', async () => {
      const user = userEvent.setup();
      const view = renderStep(LineHuntStep, step);
      await user.click(line(3));
      expect(screen.queryByText('Which input proves the fix?')).not.toBeInTheDocument();
      await user.click(reason(/NaN == false/));
      expect(screen.getByText('Prove the fix')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Which input proves the fix?' })).toBeVisible();
      // Not ready until the follow-up is answered too.
      expect(view.submission()).toBeNull();
      await user.click(reason(/abc/));
      expect(view.submission()).toEqual({
        type: 'bug-hunt',
        lines: [3],
        reasonIndex: 0,
        verifyIndex: 0,
      });
      await user.click(screen.getByRole('button', { name: 'Check' }));
      expect(view.grade()).toMatchObject({ correct: true, score: 1 });
    });

    it('calls a right hunt with a wrong check partly right, and names the check', async () => {
      const user = userEvent.setup();
      const view = renderStep(LineHuntStep, step, { reveal: false });
      await user.click(line(3));
      await user.click(reason(/NaN == false/));
      await user.click(reason(/"2"/));
      await user.click(screen.getByRole('button', { name: 'Check' }));
      expect(view.grade()?.score).toBe(0.75);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Partly right');
      expect(status).toHaveTextContent('Line 3 and the reason: right. The check is not.');
      expect(status).toHaveTextContent('A valid number passes before and after the fix.');
    });
  });
});
