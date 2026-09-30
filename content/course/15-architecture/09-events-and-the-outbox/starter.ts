export type OutboxRow = { id: number; type: string; bookingId: number };

// What a transaction may do. Both writes commit together, or neither does.
export interface Tx {
  insertBooking(room: string): number;
  insertOutbox(type: string, bookingId: number): void;
}
export interface Db {
  transaction(work: (tx: Tx) => void): void;
  unsent(): OutboxRow[];
  markSent(id: number): void;
}
export interface Broker {
  publish(event: OutboxRow): void;
}

// Today: a dual write. A crash between the two lines loses the event.
export function bookRoom(room: string, db: Db, broker: Broker): number {
  let bookingId = 0;
  db.transaction((tx) => {
    bookingId = tx.insertBooking(room);
  });
  broker.publish({ id: 0, type: 'RoomBooked', bookingId });
  return bookingId;
}

// The relay: publish every unsent outbox row, then mark it sent. Return how many.
export function relayOnce(db: Db, broker: Broker): number {
  return 0;
}
