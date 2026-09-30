import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export function GuestPicker() {
  const [guests, setGuests] = useState(2);
  return (
    <div>
      <button onClick={() => setGuests(Math.max(1, guests - 1))}>Remove a guest</button>
      <p>Guests: {guests}</p>
      <button onClick={() => setGuests(guests + 1)}>Add a guest</button>
    </div>
  );
}

// Each test gets the component to check, so we can hand it broken copies too.
export async function testAddingAGuest(Picker: typeof GuestPicker) {
  const user = userEvent.setup();
  render(<Picker />);
  await user.click(screen.getByRole('button', { name: 'Add a guest' }));
  expect(screen.getByText('Guests: 3')).toBeInTheDocument();
}

export async function testNeverBelowOne(Picker: typeof GuestPicker) {
  const user = userEvent.setup();
  render(<Picker />);
  await user.click(screen.getByRole('button', { name: 'Remove a guest' }));
  await user.click(screen.getByRole('button', { name: 'Remove a guest' }));
  expect(screen.getByText('Guests: 1')).toBeInTheDocument();
}
