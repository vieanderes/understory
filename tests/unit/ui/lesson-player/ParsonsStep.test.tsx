import { fireEvent, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParsonsStep } from '@/features/lesson-player/steps/ParsonsStep';
import { parsonsStep, renderStep } from './fixtures';

const bank = () => screen.getByRole('region', { name: 'Blocks' });
const program = () => screen.getByRole('region', { name: 'Your program' });
const bankBlock = (code: string) => within(bank()).getByRole('button', { name: new RegExp(code) });
const placed = () => within(program()).getAllByRole('group');
const placedBlock = (code: string) =>
  within(program()).getByRole('group', { name: new RegExp(code) });
const order = () => placed().map((b) => b.getAttribute('data-block'));

const CODE = {
  signature: 'function parseQuantity',
  convert: 'Number\\(text\\)',
  result: 'return quantity',
  close: '\\}$',
  'join-zero': 'text \\+ 0',
  'parse-float': 'parseFloat',
} as const;

async function place(user: UserEvent, ...ids: (keyof typeof CODE)[]) {
  for (const id of ids) await user.click(bankBlock(CODE[id]));
}

async function indent(user: UserEvent, id: keyof typeof CODE) {
  await user.click(within(placedBlock(CODE[id])).getByRole('button', { name: 'Indent' }));
}

afterEach(() => vi.restoreAllMocks());

describe('ParsonsStep', () => {
  it('starts with every block and distractor in the bank and an empty program', () => {
    renderStep(ParsonsStep, parsonsStep);
    expect(within(bank()).getAllByRole('button')).toHaveLength(6);
    expect(within(program()).getByText('Pick a block to place it here.')).toBeInTheDocument();
  });

  it('shows a subgoal label above its block in both zones', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep);
    expect(within(bankBlock(CODE.convert)).getByText('once').tagName).toBe('CODE');
    await place(user, 'convert');
    expect(placedBlock(CODE.convert)).toHaveTextContent('Convert once');
  });

  it('moves a tapped block to the end of the program', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep);
    await place(user, 'close', 'signature');
    expect(order()).toEqual(['close', 'signature']);
    expect(within(bank()).getAllByRole('button')).toHaveLength(4);
  });

  it('reports null until the program holds as many blocks as the solution', async () => {
    const user = userEvent.setup();
    const view = renderStep(ParsonsStep, parsonsStep);
    await place(user, 'signature', 'convert', 'result');
    expect(view.submission()).toBeNull();
    await place(user, 'close');
    expect(view.submission()).not.toBeNull();
  });

  it('reports order and indents, which the real grader accepts', async () => {
    const user = userEvent.setup();
    const view = renderStep(ParsonsStep, parsonsStep);
    await place(user, 'signature', 'convert', 'result', 'close');
    await indent(user, 'convert');
    await indent(user, 'result');
    expect(view.submission()).toEqual({
      type: 'parsons',
      order: ['signature', 'convert', 'result', 'close'],
      indents: { signature: 0, convert: 1, result: 1, close: 0 },
    });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(within(program()).getAllByText('In place')).toHaveLength(4);
  });

  it('leaves indents out, with their buttons, when the step does not check them', async () => {
    const user = userEvent.setup();
    const flat = { ...parsonsStep, checkIndent: false };
    const view = renderStep(ParsonsStep, flat);
    await place(user, 'signature', 'convert', 'result', 'close');
    expect(view.submission()).toEqual({
      type: 'parsons',
      order: ['signature', 'convert', 'result', 'close'],
    });
    expect(screen.queryByRole('button', { name: 'Indent' })).not.toBeInTheDocument();
  });

  it('gives every placed block labelled controls, off at the ends', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep);
    await place(user, 'signature', 'close');
    const first = within(placedBlock(CODE.signature));
    for (const name of ['Move up', 'Move down', 'Outdent', 'Indent', 'Remove'])
      expect(first.getByRole('button', { name })).toBeInTheDocument();
    expect(first.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(first.getByRole('button', { name: 'Outdent' })).toBeDisabled();
    expect(
      within(placedBlock(CODE.close)).getByRole('button', { name: 'Move down' }),
    ).toBeDisabled();
  });

  it('reorders with the buttons and keeps focus on the button pressed', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep);
    await place(user, 'signature', 'convert', 'close');
    const up = () => within(placedBlock(CODE.close)).getByRole('button', { name: 'Move up' });
    await user.click(up());
    expect(order()).toEqual(['signature', 'close', 'convert']);
    expect(up()).toHaveFocus();
    await user.click(up());
    // At the top the button goes off, so focus falls back to the block itself.
    expect(order()).toEqual(['close', 'signature', 'convert']);
    expect(placedBlock(CODE.close)).toHaveFocus();
  });

  it('reorders, indents and removes from the keyboard, and announces each move', async () => {
    const user = userEvent.setup();
    const view = renderStep(ParsonsStep, parsonsStep);
    // Enter on a bank block places it and moves focus to the next bank block.
    bankBlock(CODE.close).focus();
    await user.keyboard('{Enter}');
    expect(order()).toEqual(['close']);
    expect(within(bank()).getAllByRole('button')).toContain(document.activeElement);
    await place(user, 'signature', 'convert');

    const live = view.container.querySelector('[aria-live="polite"]');
    placedBlock(CODE.close).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(order()).toEqual(['signature', 'close', 'convert']);
    expect(live).toHaveTextContent('Block moved to position 2 of 3');
    expect(placedBlock(CODE.close)).toHaveFocus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(live).toHaveTextContent('Block moved to position 3 of 3');
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(order()).toEqual(['signature', 'close', 'convert']);

    placedBlock(CODE.convert).focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(live).toHaveTextContent('Indent 1');
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(live).toHaveTextContent('Indent 0');

    await user.keyboard('{Delete}');
    expect(order()).toEqual(['signature', 'close']);
    expect(live).toHaveTextContent('Block removed');
    expect(placedBlock(CODE.close)).toHaveFocus();
    expect(bankBlock(CODE.convert)).toBeInTheDocument();
  });

  it('reorders by dragging the grip, with a line where the block will land', async () => {
    const user = userEvent.setup();
    const view = renderStep(ParsonsStep, parsonsStep);
    await place(user, 'signature', 'convert', 'close');
    // jsdom lays nothing out, so give each block a 50 px row of its own.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = order().indexOf(this.getAttribute('data-block')) * 50;
      return {
        top,
        height: 50,
        bottom: top + 50,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: top,
      } as DOMRect;
    });
    const grip = placedBlock(CODE.close).querySelector('[data-grip]');
    if (!grip) throw new Error('no grip');
    expect(grip).toHaveClass('touch-none');
    fireEvent.pointerDown(grip, { button: 0, clientY: 125, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 10, pointerId: 1 });
    expect(view.container.querySelectorAll('.border-accent')).toHaveLength(1);
    fireEvent.pointerUp(grip, { clientY: 10, pointerId: 1 });
    expect(order()).toEqual(['close', 'signature', 'convert']);
    expect(view.container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Block moved to position 1 of 3',
    );
  });

  it('with a second try on offer, marks each block and explains the distractor only', async () => {
    const user = userEvent.setup();
    const view = renderStep(ParsonsStep, parsonsStep, { reveal: false });
    await place(user, 'signature', 'join-zero', 'result', 'close', 'convert');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(false);
    expect(within(placedBlock(CODE.signature)).getByText('In place')).toBeInTheDocument();
    expect(within(placedBlock(CODE['join-zero'])).getByText('Does not belong')).toBeInTheDocument();
    expect(within(placedBlock(CODE.convert)).getByText('Out of place')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Plus with a string joins text.');
    expect(screen.queryByText('Correct program')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
  });

  it('flags a wrong indent without saying what it should be', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep, { reveal: false });
    await place(user, 'signature', 'convert', 'result', 'close');
    await indent(user, 'convert');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(within(placedBlock(CODE.result)).getByText('Wrong indent')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Check the indentation.');
  });

  it('once the attempt is over, shows the correct program', async () => {
    const user = userEvent.setup();
    renderStep(ParsonsStep, parsonsStep, { reveal: true });
    await place(user, 'close', 'convert', 'result', 'signature');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const heading = screen.getByRole('heading', { name: 'Correct program' });
    const lines = [...(heading.nextElementSibling?.querySelectorAll('.line') ?? [])];
    expect(lines.map((l) => l.textContent)).toEqual(parsonsStep.blocks.map((b) => b.code));
  });

  it('drops one distractor on the second try', () => {
    renderStep(ParsonsStep, parsonsStep, { tryNumber: 2 });
    expect(within(bank()).getAllByRole('button')).toHaveLength(5);
    const real = parsonsStep.blocks.map((b) => b.code);
    const shown = within(bank())
      .getAllByRole('button')
      .map((b) => b.querySelector('.line')?.textContent);
    expect(shown).toEqual(expect.arrayContaining(real));
  });
});
