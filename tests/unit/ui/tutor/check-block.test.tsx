import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckBlock } from '@/features/tutor/CheckBlock';

const body = JSON.stringify({
  question: 'What does the inner function see?',
  options: [
    { text: 'The binding', correct: true, feedback: 'Yes: it keeps the binding.' },
    { text: 'A copy', correct: false, feedback: 'It keeps the binding, not a copy.' },
  ],
});

describe('CheckBlock', () => {
  it('shows the feedback for the pick and takes no second pick', async () => {
    const user = userEvent.setup();
    render(<CheckBlock body={body} canSend onSend={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'The binding' }));
    expect(screen.getByRole('status')).toHaveTextContent('Right');
    expect(screen.getByRole('button', { name: /A copy/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Talk it through' })).not.toBeInTheDocument();
  });

  it('sends a wrong pick back to Scout when asked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<CheckBlock body={body} canSend onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: 'A copy' }));
    expect(screen.getByRole('status')).toHaveTextContent('Not quite');
    await user.click(screen.getByRole('button', { name: 'Talk it through' }));
    expect(onSend).toHaveBeenCalledWith('I picked "A copy" on your check.');
  });

  it('draws nothing for a broken block', () => {
    const { container } = render(<CheckBlock body="{" canSend onSend={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
