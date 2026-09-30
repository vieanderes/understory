import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloorGuide } from './solution';

const floor = (name: string) => screen.getByRole('button', { name });

test('starts with every panel closed', () => {
  render(<FloorGuide />);
  expect(floor('Ground floor')).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Fossils and a café.')).not.toBeInTheDocument();
});

test('a click opens that panel', async () => {
  const user = userEvent.setup();
  render(<FloorGuide />);
  await user.click(floor('First floor'));
  expect(floor('First floor')).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Paintings from five centuries.')).toBeInTheDocument();
});

test('opening another panel closes the first', async () => {
  const user = userEvent.setup();
  render(<FloorGuide />);
  await user.click(floor('Ground floor'));
  await user.click(floor('Second floor'));
  expect(screen.getByText('A roof garden with views.')).toBeInTheDocument();
  expect(screen.queryByText('Fossils and a café.')).not.toBeInTheDocument();
  expect(floor('Ground floor')).toHaveAttribute('aria-expanded', 'false');
});

test('only one panel is ever open', async () => {
  const user = userEvent.setup();
  render(<FloorGuide />);
  await user.click(floor('Ground floor'));
  await user.click(floor('First floor'));
  await user.click(floor('Second floor'));
  const open = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true');
  expect(open).toHaveLength(1);
});
