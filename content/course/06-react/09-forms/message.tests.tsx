import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageForm } from './message.solution';

const field = () => screen.getByLabelText('Message');
const sendButton = () => screen.getByRole('button', { name: 'Send' });

test('starts empty, with 20 characters left and Send disabled', () => {
  render(<MessageForm onSend={() => {}} />);
  expect(field()).toHaveValue('');
  expect(screen.getByText('20 characters left')).toBeInTheDocument();
  expect(sendButton()).toBeDisabled();
});

test('counts down as you type, and enables Send', async () => {
  const user = userEvent.setup();
  render(<MessageForm onSend={() => {}} />);
  await user.type(field(), 'Hello');
  expect(screen.getByText('15 characters left')).toBeInTheDocument();
  expect(sendButton()).toBeEnabled();
});

test('spaces alone are not a message', async () => {
  const user = userEvent.setup();
  render(<MessageForm onSend={() => {}} />);
  await user.type(field(), '   ');
  expect(screen.getByText('17 characters left')).toBeInTheDocument();
  expect(sendButton()).toBeDisabled();
});

test('too long says by how much, and blocks Send', async () => {
  const user = userEvent.setup();
  render(<MessageForm onSend={() => {}} />);
  await user.type(field(), 'See you at the station');
  expect(screen.getByText('2 characters too many')).toBeInTheDocument();
  expect(sendButton()).toBeDisabled();
  await user.type(field(), '{Backspace}{Backspace}');
  expect(screen.getByText('0 characters left')).toBeInTheDocument();
  expect(sendButton()).toBeEnabled();
});

test('Send hands over the text and empties the field', async () => {
  const user = userEvent.setup();
  const sent: string[] = [];
  render(<MessageForm onSend={(text) => sent.push(text)} />);
  await user.type(field(), 'On my way');
  await user.click(sendButton());
  expect(sent).toEqual(['On my way']);
  expect(field()).toHaveValue('');
  expect(screen.getByText('20 characters left')).toBeInTheDocument();
});
