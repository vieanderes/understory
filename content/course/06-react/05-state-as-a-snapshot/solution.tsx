import { useState } from 'react';

const MAX = 8;

export function TicketPicker() {
  const [tickets, setTickets] = useState(0);
  const full = tickets >= MAX;

  function addOne() {
    // An updater builds on the pending value, so three calls in one click add three.
    setTickets((n) => (n < MAX ? n + 1 : n));
  }

  function addThree() {
    addOne();
    addOne();
    addOne();
  }

  return (
    <div>
      <p>Tickets: {tickets}</p>
      <button onClick={addOne} disabled={full}>
        Add one
      </button>
      <button onClick={addThree} disabled={full}>
        Add three
      </button>
    </div>
  );
}
