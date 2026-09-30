import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from './booking.solution';

const field = () => screen.getByLabelText('Your name');

test('a blank name shows a message and books nothing', async () => {
  const user = userEvent.setup();
  const booked: string[] = [];
  render(<BookingForm reserve={async (name) => { booked.push(name); }} />);
  await user.type(field(), '   ');
  await user.click(screen.getByRole('button', { name: 'Book' }));
  expect(await screen.findByText('Add a name for the booking.')).toBeInTheDocument();
  expect(booked).toEqual([]);
});

test('a name is sent to reserve, trimmed, and confirmed', async () => {
  const user = userEvent.setup();
  const booked: string[] = [];
  render(<BookingForm reserve={async (name) => { booked.push(name); }} />);
  await user.type(field(), ' Priya ');
  await user.click(screen.getByRole('button', { name: 'Book' }));
  expect(await screen.findByText('Booked for Priya.')).toBeInTheDocument();
  expect(booked).toEqual(['Priya']);
});

test('the button says Booking and is disabled while it saves', async () => {
  const user = userEvent.setup();
  let finish = () => {};
  const reserve = () => new Promise<void>((resolve) => { finish = resolve; });
  render(<BookingForm reserve={reserve} />);
  await user.type(field(), 'Sam');
  await user.click(screen.getByRole('button', { name: 'Book' }));
  const busy = await screen.findByRole('button', { name: 'Booking' });
  expect(busy).toBeDisabled();
  finish();
  expect(await screen.findByText('Booked for Sam.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Book' })).toBeEnabled();
});
