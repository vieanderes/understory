import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExplainBackStep } from '@/features/lesson-player/steps/ExplainBackStep';
import { explainStep, renderStep } from './fixtures';

const TEXT = 'The field gives a string so plus joins the text';

describe('ExplainBackStep', () => {
  it('counts words live and keeps Compare off until something is written', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    const box = screen.getByRole('textbox', { name: 'Your explanation' });
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/0 words.*Aim for 30 to 80/);
    await user.type(box, 'One');
    expect(box).toHaveAccessibleDescription(/1 word Aim/);
    await user.type(box, ' two  three ');
    expect(box).toHaveAccessibleDescription(/3 words/);
    expect(screen.getByRole('button', { name: 'Compare' })).toBeEnabled();
    // Writing alone is not an answer: the self-grade is.
    expect(view.submission()).toBeUndefined();
    expect(screen.queryByText('Model answer')).not.toBeInTheDocument();
  });

  it('reports as soon as the model answer shows, and again as boxes change', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText('Model answer')).toBeInTheDocument();
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 0 });
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'My explanation made this point' })).toBeVisible();
    await user.click(boxes[0]!);
    await user.click(screen.getByRole('checkbox', { name: /joins text/ }));
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 2 });
    await user.click(boxes[0]!);
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 1 });
  });

  it('never puts the written text in the submission', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(JSON.stringify(view.submission())).not.toContain('string');
  });

  it('works by keyboard, grades through the real grader and sums up in one line', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Compare' })).toHaveFocus();
    await user.keyboard('{Enter}');
    for (const box of screen.getAllByRole('checkbox')) {
      box.focus();
      await user.keyboard(' ');
    }
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 3 });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 points made');
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
  });

  it('renders code in a rubric point as code', async () => {
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText('+').tagName).toBe('CODE');
  });
});
