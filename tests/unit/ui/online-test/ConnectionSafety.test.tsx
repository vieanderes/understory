import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionRequest, SafetyNote } from '@/features/online-test/assistant/ConnectionSafety';

describe('ConnectionRequest', () => {
  it('names the code and hands Allow and Deny back', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(<ConnectionRequest code="ABCD2345" at={0} onDecide={onDecide} />);
    const region = screen.getByRole('region', { name: 'Connection request' });
    expect(region).toHaveTextContent('ABCD-2345');
    expect(region).toHaveTextContent('only if you just gave Claude this code');
    await user.click(screen.getByRole('button', { name: 'Allow' }));
    await user.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onDecide.mock.calls).toEqual([[true], [false]]);
  });
});

describe('SafetyNote', () => {
  it('says to choose No sign-in and opens the full explanation on demand', async () => {
    const user = userEvent.setup();
    render(<SafetyNote />);
    expect(screen.getByText(/Choose No sign-in/)).toBeInTheDocument();
    expect(screen.queryByText('Three locks')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How this stays safe' }));
    expect(screen.getByText('Three locks')).toBeInTheDocument();
    expect(screen.getByText(/never leaves this browser/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(screen.queryByText('Three locks')).not.toBeInTheDocument();
  });
});
