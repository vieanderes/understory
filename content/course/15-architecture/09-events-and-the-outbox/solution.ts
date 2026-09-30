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

// The event is a row in the booking's own transaction, so it exists exactly when the booking does.
export function bookRoom(room: string, db: Db): number {
  let bookingId = 0;
  db.transaction((tx) => {
    bookingId = tx.insertBooking(room);
    tx.insertOutbox('RoomBooked', bookingId);
  });
  return bookingId;
}

// Mark a row sent only after the broker has it. A crash in between sends it twice, never zero times.
export function relayOnce(db: Db, broker: Broker): number {
  const rows = db.unsent();
  for (const row of rows) {
    broker.publish(row);
    db.markSent(row.id);
  }
  return rows.length;
}
