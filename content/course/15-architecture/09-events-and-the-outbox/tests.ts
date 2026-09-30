import { bookRoom, relayOnce, type Db, type OutboxRow, type Broker } from './solution';

// An in-memory database whose transaction really is all or nothing.
function fakeDb(options: { failOutbox?: boolean } = {}) {
  const bookings: string[] = [];
  const outbox: (OutboxRow & { sent: boolean })[] = [];
  const db: Db = {
    transaction(work) {
      const bookingsBefore = bookings.length;
      const outboxBefore = outbox.length;
      try {
        work({
          insertBooking(room) {
            bookings.push(room);
            return bookings.length;
          },
          insertOutbox(type, bookingId) {
            if (options.failOutbox) throw new Error('disk full');
            outbox.push({ id: outbox.length + 1, type, bookingId, sent: false });
          },
        });
      } catch (error) {
        bookings.length = bookingsBefore; // roll back
        outbox.length = outboxBefore;
        throw error;
      }
    },
    unsent: () => outbox.filter((row) => !row.sent).map(({ id, type, bookingId }) => ({ id, type, bookingId })),
    markSent(id) {
      const row = outbox.find((r) => r.id === id);
      if (row) row.sent = true;
    },
  };
  return { db, bookings, outbox };
}

function fakeBroker(options: { down?: boolean } = {}): Broker & { got: OutboxRow[] } {
  const got: OutboxRow[] = [];
  return {
    got,
    publish(event) {
      if (options.down) throw new Error('broker unreachable');
      got.push(event);
    },
  };
}

test('booking writes an outbox row in the same transaction', () => {
  const { db, outbox } = fakeDb();
  bookRoom('oak', db);
  expect(outbox).toEqual([{ id: 1, type: 'RoomBooked', bookingId: 1, sent: false }]);
});

test('the relay publishes the row and marks it sent', () => {
  const { db } = fakeDb();
  const broker = fakeBroker();
  bookRoom('oak', db);
  expect(relayOnce(db, broker)).toBe(1);
  expect(broker.got).toEqual([{ id: 1, type: 'RoomBooked', bookingId: 1 }]);
  expect(relayOnce(db, broker)).toBe(0);
});

test('if the outbox write fails, the booking rolls back too', () => {
  const { db, bookings, outbox } = fakeDb({ failOutbox: true });
  expect(() => bookRoom('oak', db)).toThrow('disk full');
  expect(bookings).toHaveLength(0);
  expect(outbox).toHaveLength(0);
});

test('a broker outage loses nothing: the next run sends it', () => {
  const { db } = fakeDb();
  bookRoom('oak', db);
  expect(() => relayOnce(db, fakeBroker({ down: true }))).toThrow('broker unreachable');
  const broker = fakeBroker();
  expect(relayOnce(db, broker)).toBe(1);
  expect(broker.got).toEqual([{ id: 1, type: 'RoomBooked', bookingId: 1 }]);
});
