import { useState } from 'react';
import { cleanup } from '@testing-library/react';
import { GuestPicker, testAddingAGuest, testNeverBelowOne } from './solution';

type Picker = typeof GuestPicker;
const yours = [testAddingAGuest, testNeverBelowOne];

async function failureOf(version: Picker, check: (picker: Picker) => Promise<void>) {
  try {
    await check(version);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    cleanup();
  }
}

async function expectCaught(version: Picker, hint: string) {
  for (const check of yours) if ((await failureOf(version, check)) !== null) return;
  throw new Error(`Both tests still pass. ${hint}`);
}

function AddsTwo() {
  const [guests, setGuests] = useState(2);
  return (
    <div>
      <button onClick={() => setGuests(Math.max(1, guests - 1))}>Remove a guest</button>
      <p>Guests: {guests}</p>
      <button onClick={() => setGuests(guests + 2)}>Add a guest</button>
    </div>
  );
}

function GoesToZero() {
  const [guests, setGuests] = useState(2);
  return (
    <div>
      <button onClick={() => setGuests(guests - 1)}>Remove a guest</button>
      <p>Guests: {guests}</p>
      <button onClick={() => setGuests(guests + 1)}>Add a guest</button>
    </div>
  );
}

function SymbolsOnly() {
  const [guests, setGuests] = useState(2);
  return (
    <div>
      <button onClick={() => setGuests(Math.max(1, guests - 1))}>-</button>
      <p>Guests: {guests}</p>
      <button onClick={() => setGuests(guests + 1)}>+</button>
    </div>
  );
}

test('your tests pass on the real GuestPicker', async () => {
  for (const check of yours) {
    const failure = await failureOf(GuestPicker, check);
    if (failure !== null) throw new Error(`${check.name} fails on working code: ${failure}`);
  }
});

test('they catch an Add button that adds two', async () => {
  await expectCaught(AddsTwo, 'Check the exact count after one click.');
});

test('they catch a Remove button that goes below one', async () => {
  await expectCaught(GoesToZero, 'Remove more guests than there are.');
});

test('they catch buttons that show only + and -', async () => {
  await expectCaught(SymbolsOnly, 'Find each button by its role and its name.');
});
