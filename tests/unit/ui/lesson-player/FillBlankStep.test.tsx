import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FillBlankStep } from '@/features/lesson-player/steps/FillBlankStep';
import { fillStep, renderStep } from './fixtures';

const token = (name: string) =>
  within(screen.getByRole('group', { name: 'Tokens' })).getByRole('button', { name });
const slot = (name: string | RegExp) =>
  within(screen.getByRole('group', { name: 'Code to complete' })).getByRole('button', { name });

describe('FillBlankStep', () => {
  it('mounts one slot per blank inside the code, and the whole bank below', () => {
    const view = renderStep(FillBlankStep, fillStep);
    expect(slot('Blank 1, empty').closest('[data-blank]')).toHaveAttribute('data-blank', '1');
    expect(slot('Blank 2, empty').closest('.line')).toHaveAttribute('data-line', '2');
    const bank = within(screen.getByRole('group', { name: 'Tokens' })).getAllByRole('button');
    expect(bank.map((b) => b.textContent).sort()).toEqual([...fillStep.bank].sort());
    expect(view.container.querySelector('input, textarea')).toBeNull();
  });

  it('shuffles the bank by the seed, the same way every time', () => {
    const names = () =>
      within(screen.getByRole('group', { name: 'Tokens' }))
        .getAllByRole('button')
        .map((b) => b.textContent);
    const first = renderStep(FillBlankStep, fillStep, { seed: 3 });
    const order = names();
    first.unmount();
    renderStep(FillBlankStep, fillStep, { seed: 3 });
    expect(names()).toEqual(order);
  });

  it('fills the first empty slot, reports a complete answer and grades right', async () => {
    const user = userEvent.setup();
    const view = renderStep(FillBlankStep, fillStep);
    await user.click(token('Number'));
    expect(view.submission()).toBeNull();
    await user.click(token('typeof'));
    expect(view.submission()).toEqual({
      type: 'fill-blank',
      values: { '1': 'Number', '2': 'typeof' },
    });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
  });

  it('dims a used token in place and ignores a second press', async () => {
    const user = userEvent.setup();
    renderStep(FillBlankStep, fillStep);
    await user.click(token('Number'));
    expect(token('Number')).toHaveAttribute('aria-disabled', 'true');
    await user.click(token('Number'));
    expect(slot('Blank 2, empty')).toBeInTheDocument();
  });

  it('empties a filled slot on press and sends the next token there', async () => {
    const user = userEvent.setup();
    const view = renderStep(FillBlankStep, fillStep);
    await user.click(token('String'));
    await user.click(token('typeof'));
    await user.click(slot('Remove String from blank 1'));
    expect(view.submission()).toBeNull();
    expect(slot('Blank 1, empty')).toHaveAttribute('aria-pressed', 'true');
    expect(token('String')).toHaveAttribute('aria-disabled', 'false');
    await user.click(token('Number'));
    expect(view.submission()).toEqual({
      type: 'fill-blank',
      values: { '1': 'Number', '2': 'typeof' },
    });
  });

  it('fills the selected slot before the first empty one', async () => {
    const user = userEvent.setup();
    renderStep(FillBlankStep, fillStep);
    await user.click(slot('Blank 2, empty'));
    await user.click(token('typeof'));
    expect(slot('Remove typeof from blank 2')).toBeInTheDocument();
    expect(slot('Blank 1, empty')).toBeInTheDocument();
  });

  it('works by keyboard alone: Tab to a control, Enter or Space to act', async () => {
    const user = userEvent.setup();
    const view = renderStep(FillBlankStep, fillStep);
    token('Number').focus();
    await user.keyboard('{Enter}');
    token('typeof').focus();
    await user.keyboard(' ');
    expect(view.submission()).toEqual({
      type: 'fill-blank',
      values: { '1': 'Number', '2': 'typeof' },
    });
    // Slots come before the bank in the tab order, as they do on the page.
    slot('Remove Number from blank 1').focus();
    await user.tab();
    expect(slot('Remove typeof from blank 2')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(view.submission()).toBeNull();
  });

  it('with a second try on offer, marks the wrong slot and keeps the token back', async () => {
    const user = userEvent.setup();
    const view = renderStep(FillBlankStep, fillStep, { reveal: false });
    await user.click(token('String'));
    await user.click(token('typeof'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(false);
    const code = screen.getByRole('group', { name: 'Code to complete' });
    expect(within(code).getByText('Wrong')).toBeInTheDocument();
    expect(within(code).getByText('Right')).toBeInTheDocument();
    expect(within(code).queryByText('Number')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 blanks right.');
    expect(screen.queryByRole('group', { name: 'Tokens' })).not.toBeInTheDocument();
  });

  it('once the attempt is over, shows the right token in the wrong slot', async () => {
    const user = userEvent.setup();
    renderStep(FillBlankStep, fillStep, { reveal: true });
    await user.click(token('String'));
    await user.click(token('typeof'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const host = screen.getByText('Right token:').closest('[data-blank]');
    expect(host).toHaveAttribute('data-blank', '1');
    expect(host).toHaveTextContent('Number');
    expect(host).toHaveTextContent('String');
  });
});
