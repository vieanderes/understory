export type State = 'placed' | 'paid' | 'shipped' | 'cancelled';

// Every allowed move, in one place. A move that isn't listed can't happen.
const NEXT: Record<State, State[]> = {
  placed: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

export function makeOrder() {
  let state: State = 'placed';
  function move(to: State) {
    if (!NEXT[state].includes(to)) throw new Error(`cannot go from ${state} to ${to}`);
    state = to;
  }
  return {
    pay: () => move('paid'),
    ship: () => move('shipped'),
    cancel: () => move('cancelled'),
    status: (): State => state,
  };
}
