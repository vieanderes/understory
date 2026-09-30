import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildScenario, run } from '@/core/labs/event-loop-stepper';
import EventLoopStepper from '@/features/labs/event-loop-stepper';
import { parsePreset } from '@/features/labs/event-loop-stepper/preset';

const step = () => userEvent.click(screen.getByRole('button', { name: 'Step' }));
const box = (name: string | RegExp) => screen.getByRole('region', { name });

describe('EventLoopStepper', () => {
  it('opens on the classic scenario with its prediction prompt and the script as first task', () => {
    render(<EventLoopStepper />);
    expect(screen.getByRole('heading', { level: 1, name: 'Event loop stepper' })).toBeVisible();
    expect(screen.getByText('Before you step: four lines log. In what order?')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue('classic');
    expect(within(box('Task queue')).getByText('script')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('The script is the first task');
    expect(screen.getByText('Step 1 of 14')).toBeVisible();
  });

  it('steps forward and back: the line, the stack, the console and the status follow', async () => {
    render(<EventLoopStepper />);
    await step();
    await step();
    expect(screen.getByRole('status')).toHaveTextContent('console.log prints "checkout opened".');
    expect(within(box('Call stack')).getByText('script')).toBeVisible();
    expect(within(box('Console')).getByText('checkout opened')).toBeVisible();
    expect(
      within(box('Program')).getByText("console.log('checkout opened');").closest('li'),
    ).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Line 1 is running.')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Step back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByRole('button', { name: 'Step back' })).toBeDisabled();
    expect(within(box('Console')).getByText('no output yet')).toBeVisible();
  });

  it('shows a 0 ms timer in the task queue and the reaction in the microtask queue', async () => {
    render(<EventLoopStepper />);
    for (let i = 0; i < 4; i += 1) await step();
    expect(within(box('Task queue')).getByText('expireHold')).toBeVisible();
    expect(within(box('Microtask queue')).getByText('confirmSeat')).toBeVisible();
    expect(within(box('Microtask queue')).getByText('next, then')).toBeVisible();
  });

  it('marks the phase of the loop in words', async () => {
    render(<EventLoopStepper />);
    const current = () =>
      within(screen.getByRole('region', { name: 'Loop phase' }))
        .getAllByRole('listitem')
        .find((li) => li.getAttribute('aria-current') === 'step');
    expect(current()).toHaveTextContent('4 Wait');
    await step();
    expect(current()).toHaveTextContent('1 Run one task');
  });

  it('runs to the same console output as the engine', async () => {
    render(<EventLoopStepper />);
    const expected = run(buildScenario('classic')).at(-1)!.output;
    for (let i = 0; i < 13; i += 1) await step();
    expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled();
    const lines = within(box('Console')).getAllByRole('listitem');
    expect(lines.map((li) => li.textContent)).toEqual(expected);
  });

  it('changes the scenario by keyboard and starts again from its prompt', async () => {
    render(<EventLoopStepper />);
    await step();
    const select = screen.getByRole('combobox', { name: 'Scenario' });
    select.focus();
    await userEvent.selectOptions(select, 'async-await');
    expect(screen.getByText(/does holdSeat finish before sendReceipt starts/)).toBeVisible();
    expect(screen.getByText(/^Step 1 of/)).toBeVisible();
    expect(within(box('Program')).getByText('async function holdSeat() {')).toBeVisible();
  });

  it('changes the parameter with the arrow keys, and the program follows', async () => {
    render(<EventLoopStepper preset={{ scenario: 'blocked-click' }} />);
    expect(within(box('Program')).getByText(/synchronous, 120 ms/)).toBeVisible();
    await step();
    const group = screen.getByRole('radiogroup', { name: 'Blocking work (ms)' });
    within(group).getByRole('radio', { name: '120' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(within(group).getByRole('radio', { name: '40' })).toBeChecked();
    expect(within(box('Program')).getByText(/synchronous, 40 ms/)).toBeVisible();
    expect(screen.getByText(/^Step 1 of/)).toBeVisible();
  });

  it('shows pending paint and the painted screen in the blocked click', async () => {
    render(<EventLoopStepper preset={{ scenario: 'blocked-click' }} />);
    await step();
    await step();
    const renderBox = box(/^Render/);
    expect(within(renderBox).getByText('button reads "Buying"')).toBeVisible();
    expect(within(renderBox).getByText('no paint yet')).toBeVisible();
    for (let i = 0; i < 7; i += 1) await step();
    expect(within(renderBox).getByText('button reads "Buying" (at 120 ms)')).toBeVisible();
    expect(screen.getByText('now')).toBeVisible();
  });

  it('takes a scenario and a value from the preset, and can hide the switcher', () => {
    render(
      <EventLoopStepper
        embedded
        preset={{ scenario: 'async-await', value: 3, hideSwitcher: true }}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('radio', { name: '3' })).toBeChecked();
    expect(within(box('Program')).getByText(/hop 3/)).toBeVisible();
  });

  it('says what it leaves out', async () => {
    render(<EventLoopStepper />);
    await userEvent.click(screen.getByText('What this leaves out'));
    expect(screen.getByText(/process\.nextTick runs before promise microtasks/)).toBeVisible();
  });
});

describe('parsePreset', () => {
  it('falls back to the default scenario for anything invalid', () => {
    const fallback = { scenario: 'classic', value: undefined, hideSwitcher: false };
    expect(parsePreset(undefined)).toEqual(fallback);
    expect(parsePreset({ scenario: 'nope' })).toEqual(fallback);
    expect(parsePreset({ scenario: 'classic', hideSwitcher: 'yes' })).toEqual(fallback);
  });

  it('keeps what is valid and ignores unknown keys', () => {
    expect(parsePreset({ scenario: 'frame-order', value: 20, extra: 1 })).toEqual({
      scenario: 'frame-order',
      value: 20,
      hideSwitcher: false,
    });
  });
});

describe('an overdue render', () => {
  it('is named while the blocking task still holds the stack', async () => {
    render(<EventLoopStepper preset={{ scenario: 'blocked-click' }} />);
    for (let i = 0; i < 5; i += 1) await step();
    expect(screen.getByText('16 ms, overdue')).toBeVisible();
  });
});
