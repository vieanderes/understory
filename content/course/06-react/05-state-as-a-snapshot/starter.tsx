import { useState } from 'react';

const MAX = 8;

// "Add three" only ever adds one. Fix it, and never let the count pass MAX.
export function TicketPicker() {
  const [tickets, setTickets] = useState(0);

  function addOne() {
    setTickets(tickets + 1);
  }

  function addThree() {
    addOne();
    addOne();
    addOne();
  }

  return (
    <div>
      <p>Tickets: {tickets}</p>
      <button onClick={addOne}>Add one</button>
      <button onClick={addThree}>Add three</button>
    </div>
  );
}
