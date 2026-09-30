import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketPicker } from './solution';

const addOne = () => screen.getByRole('button', { name: 'Add one' });
const addThree = () => screen.getByRole('button', { name: 'Add three' });

test('starts with no tickets', () => {
  render(<TicketPicker />);
  expect(screen.getByText('Tickets: 0')).toBeInTheDocument();
});

test('one click on "Add three" adds three', async () => {
  const user = userEvent.setup();
  render(<TicketPicker />);
  await user.click(addThree());
  expect(screen.getByText('Tickets: 3')).toBeInTheDocument();
  await user.click(addOne());
  expect(screen.getByText('Tickets: 4')).toBeInTheDocument();
});

test('the count stops at 8, even in the middle of a click', async () => {
  const user = userEvent.setup();
  render(<TicketPicker />);
  await user.click(addThree());
  await user.click(addThree());
  await user.click(addOne());
  expect(screen.getByText('Tickets: 7')).toBeInTheDocument();
  await user.click(addThree());
  expect(screen.getByText('Tickets: 8')).toBeInTheDocument();
});

test('both buttons are disabled once it is full', async () => {
  const user = userEvent.setup();
  render(<TicketPicker />);
  expect(addOne()).toBeEnabled();
  await user.click(addThree());
  await user.click(addThree());
  expect(addThree()).toBeEnabled();
  await user.click(addThree());
  expect(addOne()).toBeDisabled();
  expect(addThree()).toBeDisabled();
});
