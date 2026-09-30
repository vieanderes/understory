import { confirm, expire, HOLD_MS, reserve, type Store } from './solution';

const newShow = (capacity: number): Store => ({ capacity, sold: 0, held: 0, holds: new Map() });

test('a reserve that fits creates an active hold', () => {
  const show = newShow(3);
  expect(reserve(show, 'a', 2, 0)).toBe(true);
  expect(show.held).toBe(2);
});

test('reserve counts held seats as taken', () => {
  const show = newShow(2);
  reserve(show, 'a', 2, 0);
  expect(reserve(show, 'b', 1, 0)).toBe(false);
});

test('confirm in time sells the seats', () => {
  const show = newShow(2);
  reserve(show, 'a', 2, 0);
  expect(confirm(show, 'a', 1000)).toBe('sold');
  expect([show.sold, show.held]).toEqual([2, 0]);
});

test('a payment after the hold ran out is refunded', () => {
  const show = newShow(1);
  reserve(show, 'a', 1, 0);
  expect(confirm(show, 'a', HOLD_MS + 1)).toBe('refund');
  expect(show.sold).toBe(0);
});

test('a hold the sweep expired cannot be confirmed', () => {
  const show = newShow(1);
  reserve(show, 'a', 1, 0);
  expect(expire(show, 'a', HOLD_MS)).toBe(true);
  expect(reserve(show, 'b', 1, HOLD_MS)).toBe(true);
  // The payment was stamped just inside the deadline, but arrives after the sweep.
  expect(confirm(show, 'a', HOLD_MS - 1)).toBe('refund');
  expect([show.sold, show.held]).toEqual([0, 1]);
});

test('the sweep leaves a hold alone before it runs out, and after it was paid', () => {
  const show = newShow(2);
  reserve(show, 'a', 1, 0);
  reserve(show, 'b', 1, 0);
  expect(expire(show, 'a', 5)).toBe(false);
  confirm(show, 'b', 5);
  expect(expire(show, 'b', HOLD_MS)).toBe(false);
  expect([show.sold, show.held]).toEqual([1, 1]);
});

test('a second confirm of the same hold is refunded', () => {
  const show = newShow(2);
  reserve(show, 'a', 1, 0);
  confirm(show, 'a', 1);
  expect(confirm(show, 'a', 2)).toBe('refund');
  expect(show.sold).toBe(1);
});

// A small seeded generator, so every run makes the same "random" moves.
function seeded(seed: number) {
  let state = seed;
  return (below: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
}

test('5,000 random moves never oversell', () => {
  const pick = seeded(42);
  const show = newShow(5);
  let now = 0;
  let broken = '';
  for (let move = 0; move < 5000 && broken === ''; move++) {
    now += pick(4) * 60 * 1000;
    const id = `hold-${pick(40)}`;
    const kind = pick(3);
    if (kind === 0 && !show.holds.has(id)) reserve(show, id, 1 + pick(3), now);
    if (kind === 1) confirm(show, id, now);
    if (kind === 2) expire(show, id, now);
    let active = 0;
    for (const hold of show.holds.values()) if (hold.status === 'active') active += hold.qty;
    if (show.sold + show.held > show.capacity) broken = `oversold at move ${move}`;
    if (show.held !== active) broken = `held is ${show.held}, active holds ${active}, at move ${move}`;
  }
  expect(broken).toBe('');
});
