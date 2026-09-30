import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import OversellingSimulator from '@/features/labs/overselling-simulator';
import { parsePreset } from '@/features/labs/overselling-simulator/preset';

const step = () => screen.getByRole('button', { name: /^Step$/ });
const invariant = () => screen.getByTestId('invariant');
const timeline = () => screen.getByRole('region', { name: /Timeline grid/ });

type User = ReturnType<typeof userEvent.setup>;

async function stepToEnd(user: User) {
  while (!step().hasAttribute('disabled')) await user.click(step());
}

async function byHand(user: User) {
  await user.click(screen.getByRole('radio', { name: 'By hand' }));
}

const advance = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^Advance ${name}`) });

describe('OversellingSimulator', () => {
  it('renders the title, the case, the sketch and the prediction prompt', () => {
    render(<OversellingSimulator />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Overselling simulator' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Which way of writing the reservation/)).toBeInTheDocument();
    expect(screen.getByText(/Before you step: both buyers run the same code/)).toBeInTheDocument();
    expect(screen.getByText('Check-then-act, no protection')).toBeInTheDocument();
    expect(
      screen.getByText('SELECT sold, capacity FROM events WHERE id = :id;'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has run yet');
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<OversellingSimulator embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows the store as figures, with the row lock and the capacity', () => {
    render(<OversellingSimulator />);
    const store = screen.getByRole('region', { name: 'Store' });
    expect(within(store).getByText('99')).toBeInTheDocument();
    expect(within(store).getByText('of 100')).toBeInTheDocument();
    expect(within(store).getByText('v1')).toBeInTheDocument();
    expect(within(store).getByText('free')).toBeInTheDocument();
  });

  it('steps, narrates each step, marks the line running and fills the timeline', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);

    await user.click(step());
    expect(screen.getByRole('status')).toHaveTextContent('B reads sold = 99');
    expect(screen.getByText(/SELECT sold, capacity/).closest('[data-line]')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(within(timeline()).getByText('SELECT → 99')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has run yet');
    expect(within(timeline()).queryByText('SELECT → 99')).toBeNull();
  });

  it('shows check-then-act overselling and names the tick it broke', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    expect(invariant()).toHaveTextContent('sold <= capacity: 99 <= 100. Holds so far.');
    expect(invariant()).toHaveAttribute('data-broken', 'false');

    await stepToEnd(user);
    expect(invariant()).toHaveTextContent('sold <= capacity: 101 > 100. Broken first at tick 6.');
    expect(invariant()).toHaveAttribute('data-broken', 'true');
    expect(screen.getByTestId('enumeration')).toHaveTextContent(
      '18 of 20 orderings oversell. Few enough to run one at a time.',
    );
  });

  it('switches the strategy by keyboard, and the atomic update holds', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.selectOptions(screen.getByLabelText('How reserve is written'), 'atomic-update');

    expect(screen.getByText('Atomic conditional update')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    await stepToEnd(user);
    expect(invariant()).toHaveTextContent('sold <= capacity: 100 <= 100. Holds.');
    expect(screen.getByTestId('enumeration')).toHaveTextContent('None of the 6 orderings oversell');
    expect(within(timeline()).getByText('rows 0: sold out')).toBeInTheDocument();
  });

  it('switches the scenario, takes its strategy and parameters, and starts again', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.click(step());
    await user.selectOptions(screen.getByLabelText('Scenario'), 'four-oh-two');

    expect(screen.getByText(/the dashboard says 402 of 400/)).toBeInTheDocument();
    expect(screen.getByText(/Before you step: every buyer runs in a transaction/)).toBeVisible();
    expect(screen.getByText('One transaction at READ COMMITTED')).toBeInTheDocument();
    expect(screen.getByLabelText('Capacity')).toHaveValue(400);
    expect(screen.getByLabelText('Buyers')).toHaveValue(3);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has run yet');
  });

  it('counts the orderings of a case too large to list one at a time', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'on-sale');
    expect(screen.getByTestId('enumeration')).toHaveTextContent(
      'None of the 1.25 x 10^40 orderings oversell. Too many to run one at a time',
    );
  });

  it('edits a parameter and clamps it to what the engine will run', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.click(screen.getByRole('button', { name: 'Increase Buyers' }));
    expect(screen.getByLabelText('Buyers')).toHaveValue(3);
    await user.clear(screen.getByLabelText('Sold'));
    await user.type(screen.getByLabelText('Sold'), '900');
    // The draft stays under the hand until the field is left.
    await user.tab();
    expect(screen.getByLabelText('Sold')).toHaveValue(100);
  });

  it('drives the run by hand, one actor at a time, and steps back', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await byHand(user);

    await user.click(advance('A'));
    await user.click(advance('B'));
    expect(screen.getByRole('status')).toHaveTextContent('B reads sold = 99');
    const cells = within(timeline()).getAllByText('SELECT → 99');
    expect(cells).toHaveLength(2);

    await user.click(advance('A'));
    await user.click(advance('A'));
    expect(invariant()).toHaveTextContent('sold <= capacity: 100 <= 100');
    await user.click(advance('B'));
    await user.click(advance('B'));
    expect(invariant()).toHaveTextContent('sold <= capacity: 101 > 100. Broken first at tick 6.');
    expect(screen.getByText('Step 7 of 7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(invariant()).toHaveTextContent('sold <= capacity: 100 <= 100');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
  });

  it('operates the transport from the keyboard', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    step().focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('B reads sold = 99');
    await user.keyboard(' ');
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
  });

  it('shows a blocked actor asleep on the row lock', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.selectOptions(screen.getByLabelText('How reserve is written'), 'pessimistic-lock');
    await byHand(user);
    await user.click(advance('A'));
    await user.click(advance('B'));
    expect(screen.getByRole('button', { name: 'B is asleep on the lock' })).toBeDisabled();
    expect(within(timeline()).getByText('SELECT FOR UPDATE blocked')).toBeInTheDocument();
    await user.click(advance('A'));
    expect(within(timeline()).getAllByText('asleep').length).toBeGreaterThan(0);
  });

  it('loses the sale when the sweep wins the race, without overselling', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'abandoned-checkout');
    await user.selectOptions(screen.getByLabelText('How reserve is written'), 'holds-guarded');
    await byHand(user);

    await user.click(advance('Sweep'));
    await user.click(advance('A'));
    await user.click(advance('B'));
    await user.click(advance('Sweep'));
    await user.click(advance('A'));
    await user.click(advance('A'));

    expect(invariant()).toHaveTextContent('sold <= capacity: 399 <= 400. Holds.');
    expect(screen.getByTestId('lost-sale')).toHaveTextContent(
      'Nothing was oversold, and nothing was sold',
    );
    const grid = timeline();
    expect(within(grid).getByText('refunded')).toBeInTheDocument();
    expect(within(grid).getByText('sold out')).toBeInTheDocument();
  });

  it('shows the holds table and fixes the cast in the holds variant', async () => {
    const user = userEvent.setup();
    render(<OversellingSimulator />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'abandoned-checkout');
    const store = screen.getByRole('region', { name: 'Store' });
    expect(within(store).getByRole('rowheader', { name: 'A' })).toBeInTheDocument();
    expect(within(store).getByText('active, overdue')).toBeInTheDocument();
    expect(screen.getByLabelText('Buyers')).toBeDisabled();
    expect(screen.getByLabelText('Sold')).toBeDisabled();
  });

  it('takes a preset, and falls back to the default scenario when it is invalid', () => {
    const { unmount } = render(<OversellingSimulator preset={{ scenario: 'on-sale' }} />);
    expect(screen.getByText('Optimistic concurrency')).toBeInTheDocument();
    unmount();

    render(<OversellingSimulator preset={{ scenario: 'not-a-scenario', buyers: 99 }} />);
    expect(screen.getByText('Check-then-act, no protection')).toBeInTheDocument();
    expect(screen.getByLabelText('Buyers')).toHaveValue(2);
  });

  it('hides the switchers when the lesson has chosen the case', () => {
    render(
      <OversellingSimulator preset={{ strategy: 'constraint', hideSwitcher: true }} embedded />,
    );
    expect(screen.queryByLabelText('Scenario')).toBeNull();
    expect(screen.queryByLabelText('How reserve is written')).toBeNull();
    expect(screen.getByText('Constraint as the last line of defence')).toBeInTheDocument();
  });
});

describe('parsePreset', () => {
  it('keeps what a lesson sets', () => {
    expect(parsePreset({ scenario: 'four-oh-two', sold: 350, hideSwitcher: true })).toMatchObject({
      strategy: 'transaction',
      params: { buyers: 3, capacity: 400, sold: 350, qtyEach: 1 },
      hideSwitcher: true,
    });
  });

  it('refuses a half-valid preset whole', () => {
    expect(parsePreset({ scenario: 'four-oh-two', qtyEach: 99 })).toMatchObject({
      strategy: 'check-then-act',
      params: { buyers: 2, capacity: 100, sold: 99, qtyEach: 1 },
    });
  });

  it('takes no preset at all', () => {
    expect(parsePreset(undefined).scenario.id).toBe('last-ticket');
  });
});
