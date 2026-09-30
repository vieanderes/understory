import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './solution';

const field = () => screen.getByLabelText('Password');

test('starts hidden, with a Show button', () => {
  render(<PasswordField />);
  expect(field()).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
});

test('Show reveals the password and becomes Hide', async () => {
  const user = userEvent.setup();
  render(<PasswordField />);
  await user.click(screen.getByRole('button', { name: 'Show' }));
  expect(field()).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
});

test('Hide hides it again', async () => {
  const user = userEvent.setup();
  render(<PasswordField />);
  await user.click(screen.getByRole('button', { name: 'Show' }));
  await user.click(screen.getByRole('button', { name: 'Hide' }));
  expect(field()).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
});

test('what you typed stays when you switch', async () => {
  const user = userEvent.setup();
  render(<PasswordField />);
  await user.type(field(), 'plum42');
  await user.click(screen.getByRole('button', { name: 'Show' }));
  expect(field()).toHaveValue('plum42');
});
