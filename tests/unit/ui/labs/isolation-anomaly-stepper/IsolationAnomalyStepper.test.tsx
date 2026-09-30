import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import IsolationAnomalyStepper from '@/features/labs/isolation-anomaly-stepper';
import { parsePreset } from '@/features/labs/isolation-anomaly-stepper/preset';

type User = ReturnType<typeof userEvent.setup>;

const step = () => screen.getByRole('button', { name: /^Step$/ });
const column = (tx: 1 | 2) => screen.getByRole('region', { name: new RegExp(`^T${tx},`) });

async function stepToEnd(user: User) {
  while (!step().hasAttribute('disabled')) await user.click(step());
}

describe('IsolationAnomalyStepper', () => {
  it('renders the question, both transactions, the prediction prompt and the start', () => {
    render(<IsolationAnomalyStepper />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Isolation anomaly stepper' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Before you step: T1 reads the balance twice/)).toBeInTheDocument();
    expect(
      within(column(1)).getAllByText('SELECT balance FROM accounts WHERE id = 1;'),
    ).toHaveLength(2);
    expect(within(column(2)).getByText('Card payment')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has run yet');
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
    expect(screen.getByText('The verdict comes when both transactions end.')).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<IsolationAnomalyStepper embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('steps, marks the next statement, narrates, and steps back', async () => {
    const user = userEvent.setup();
    render(<IsolationAnomalyStepper />);
    await user.click(step());
    expect(screen.getByRole('status')).toHaveTextContent('T1 ran BEGIN;');
    expect(screen.queryByText(/Before you step/)).toBeNull();
    const next = within(column(1)).getAllByRole('listitem')[1];
    expect(next).toHaveAttribute('aria-current', 'step');

    await user.click(step());
    expect(screen.getByRole('status')).toHaveTextContent('It saw balance 100.');

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByRole('status')).toHaveTextContent('T1 ran BEGIN;');
  });

  it('runs the transaction the learner picks next', async () => {
    const user = userEvent.setup();
    render(<IsolationAnomalyStepper />);
    await user.click(screen.getByRole('button', { name: 'Run T2 next' }));
    expect(screen.getByRole('status')).toHaveTextContent('T2 ran BEGIN;');
    expect(screen.getByTestId('t2-status')).toHaveTextContent('open');
    expect(screen.getByTestId('t1-status')).toHaveTextContent('not started');
  });

  it('shows a row versions table with who sees each version', async () => {
    const user = userEvent.setup();
    render(<IsolationAnomalyStepper />);
    const versions = () => screen.getByRole('region', { name: 'Versions of accounts' });
    expect(within(versions()).getByText('setup')).toBeInTheDocument();
    // T1 reads, then T2 pays: a second version appears, made by T2.
    for (let i = 0; i < 4; i += 1) await user.click(step());
    expect(screen.getAllByTestId('version')).toHaveLength(2);
    expect(within(versions()).getByText('60')).toBeInTheDocument();
  });

  it('shows a statement waiting on a row lock, and T2 cannot be run meanwhile', async () => {
    const user = userEvent.setup();
    render(<IsolationAnomalyStepper />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'lost-update');
    await user.selectOptions(screen.getByLabelText('How the write is made'), 'atomic');
    for (let i = 0; i < 4; i += 1) await user.click(step());
    expect(screen.getByTestId('t2-status')).toHaveTextContent('waiting');
    expect(screen.getByRole('button', { name: 'Run T2 next' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('It waits for T1 to release the lock');
    await stepToEnd(user);
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-serialisable', 'true');
  });

  it('breaks write skew under REPEATABLE READ and stops it under SERIALIZABLE', async () => {
    const user = userEvent.setup();
    render(<IsolationAnomalyStepper />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'write-skew');
    await user.selectOptions(screen.getByLabelText('Isolation level'), 'repeatable-read');
    await stepToEnd(user);
    expect(screen.getByTestId('invariant')).toHaveTextContent(
      'Broken: at least one doctor on call. The count is 0.',
    );
    expect(screen.getByTestId('verdict')).toHaveTextContent('Anomaly: write skew.');

    await user.selectOptions(screen.getByLabelText('Isolation level'), 'serializable');
    expect(screen.getByTestId('invariant')).toHaveTextContent(
      'Holds: at least one doctor on call.',
    );
    expect(screen.getByText(/T2 was rolled back with SQLSTATE 40001/)).toBeInTheDocument();
  });

  it('takes the case from a preset and hides the pickers when asked', () => {
    render(
      <IsolationAnomalyStepper
        preset={{ scenario: 'check-then-insert', level: 'serializable', hideSwitcher: true }}
      />,
    );
    expect(screen.queryByLabelText('Scenario')).toBeNull();
    expect(screen.getByLabelText('Isolation level')).toHaveValue('serializable');
    expect(screen.getByText(/room for three, two booked/)).toBeInTheDocument();
  });

  it('lists what the model leaves out', () => {
    render(<IsolationAnomalyStepper />);
    expect(screen.getByText('What this leaves out')).toBeInTheDocument();
    expect(screen.getByText(/More than two transactions/)).toBeInTheDocument();
  });
});

describe('parsePreset', () => {
  it('falls back to the default case whole on a typo', () => {
    expect(parsePreset({ scenario: 'nope', level: 'serializable' })).toEqual({
      scenario: 'non-repeatable-read',
      variant: 'default',
      level: 'read-committed',
      hideSwitcher: false,
    });
    expect(parsePreset(undefined).scenario).toBe('non-repeatable-read');
  });

  it('keeps a valid variant and replaces an unknown one', () => {
    expect(parsePreset({ scenario: 'lost-update', variant: 'for-update' }).variant).toBe(
      'for-update',
    );
    expect(parsePreset({ scenario: 'lost-update', variant: 'nope' }).variant).toBe(
      'read-modify-write',
    );
  });
});
