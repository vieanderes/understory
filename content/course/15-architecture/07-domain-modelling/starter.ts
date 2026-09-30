export type State = 'placed' | 'paid' | 'shipped' | 'cancelled';

// An order kept as three flags. Eight combinations, and most of them are nonsense.
export function makeOrder() {
  let isPaid = false;
  let isShipped = false;
  let isCancelled = false;
  return {
    pay() {
      isPaid = true;
    },
    ship() {
      if (isPaid) isShipped = true;
    },
    cancel() {
      isCancelled = true;
    },
    status(): State {
      if (isCancelled) return 'cancelled';
      if (isShipped) return 'shipped';
      if (isPaid) return 'paid';
      return 'placed';
    },
  };
}
