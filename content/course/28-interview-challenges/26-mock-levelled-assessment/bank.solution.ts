interface Account {
  balance: number;
  outgoing: number;
  // [timestamp, balance] after every change, in time order, for getBalance.
  history: [number, number][];
  createdAt: number;
  pending: Set<string>;
}

interface Payment {
  id: string;
  seq: number;
  owner: string;
  amount: number;
  due: number;
  status: 'pending' | 'done' | 'cancelled';
}

// Earlier due time first, then the order of scheduling.
const before = (a: Payment, b: Payment): boolean => a.due < b.due || (a.due === b.due && a.seq < b.seq);

class PaymentQueue {
  private heap: Payment[] = [];

  get size(): number {
    return this.heap.length;
  }

  peek(): Payment | undefined {
    return this.heap[0];
  }

  push(payment: Payment): void {
    const heap = this.heap;
    heap.push(payment);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(heap[i]!, heap[parent]!)) break;
      [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
      i = parent;
    }
  }

  pop(): Payment | undefined {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < heap.length && before(heap[left]!, heap[smallest]!)) smallest = left;
        if (right < heap.length && before(heap[right]!, heap[smallest]!)) smallest = right;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
        i = smallest;
      }
    }
    return top;
  }
}

export class Bank {
  private accounts = new Map<string, Account>();
  // Merged-away accounts keep their history, and the time they closed, for getBalance.
  private closed = new Map<string, { account: Account; closedAt: number }>();
  private payments = new Map<string, Payment>();
  private queue = new PaymentQueue();
  private scheduled = 0;

  // Every operation starts here, so due payments run before anything else sees the state.
  private runDue(timestamp: number): void {
    for (let next = this.queue.peek(); next && next.due <= timestamp; next = this.queue.peek()) {
      this.queue.pop();
      if (next.status !== 'pending') continue;
      next.status = 'done';
      const account = this.accounts.get(next.owner)!;
      account.pending.delete(next.id);
      if (account.balance >= next.amount) {
        this.change(account, next.due, -next.amount);
        account.outgoing += next.amount;
      }
    }
  }

  private change(account: Account, timestamp: number, delta: number): void {
    account.balance += delta;
    account.history.push([timestamp, account.balance]);
  }

  createAccount(timestamp: number, accountId: string): boolean {
    this.runDue(timestamp);
    if (this.accounts.has(accountId) || this.closed.has(accountId)) return false;
    this.accounts.set(accountId, {
      balance: 0,
      outgoing: 0,
      history: [[timestamp, 0]],
      createdAt: timestamp,
      pending: new Set(),
    });
    return true;
  }

  deposit(timestamp: number, accountId: string, amount: number): number | null {
    this.runDue(timestamp);
    const account = this.accounts.get(accountId);
    if (!account) return null;
    this.change(account, timestamp, amount);
    return account.balance;
  }

  transfer(timestamp: number, sourceId: string, targetId: string, amount: number): number | null {
    this.runDue(timestamp);
    const source = this.accounts.get(sourceId);
    const target = this.accounts.get(targetId);
    if (!source || !target || sourceId === targetId || source.balance < amount) return null;
    this.change(source, timestamp, -amount);
    this.change(target, timestamp, amount);
    source.outgoing += amount;
    return source.balance;
  }

  topSpenders(timestamp: number, n: number): string[] {
    this.runDue(timestamp);
    return [...this.accounts]
      .sort(([idA, a], [idB, b]) => b.outgoing - a.outgoing || (idA < idB ? -1 : idA > idB ? 1 : 0))
      .slice(0, n)
      .map(([id, account]) => `${id}(${account.outgoing})`);
  }

  schedulePayment(timestamp: number, accountId: string, amount: number, delay: number): string | null {
    this.runDue(timestamp);
    const account = this.accounts.get(accountId);
    if (!account) return null;
    this.scheduled += 1;
    const payment: Payment = {
      id: `payment${this.scheduled}`,
      seq: this.scheduled,
      owner: accountId,
      amount,
      due: timestamp + delay,
      status: 'pending',
    };
    this.payments.set(payment.id, payment);
    this.queue.push(payment);
    account.pending.add(payment.id);
    return payment.id;
  }

  cancelPayment(timestamp: number, accountId: string, paymentId: string): boolean {
    this.runDue(timestamp);
    const payment = this.payments.get(paymentId);
    if (!payment || payment.status !== 'pending' || payment.owner !== accountId) return false;
    // The queue entry stays and is skipped when it comes up: removing it would cost O(N).
    payment.status = 'cancelled';
    this.accounts.get(accountId)!.pending.delete(paymentId);
    return true;
  }

  mergeAccounts(timestamp: number, accountId1: string, accountId2: string): boolean {
    this.runDue(timestamp);
    const kept = this.accounts.get(accountId1);
    const merged = this.accounts.get(accountId2);
    if (!kept || !merged || accountId1 === accountId2) return false;
    this.change(kept, timestamp, merged.balance);
    kept.outgoing += merged.outgoing;
    for (const id of merged.pending) {
      this.payments.get(id)!.owner = accountId1;
      kept.pending.add(id);
    }
    merged.pending.clear();
    this.accounts.delete(accountId2);
    this.closed.set(accountId2, { account: merged, closedAt: timestamp });
    return true;
  }

  getBalance(timestamp: number, accountId: string, timeAt: number): number | null {
    this.runDue(timestamp);
    const open = this.accounts.get(accountId);
    const gone = this.closed.get(accountId);
    const account = open ?? gone?.account;
    if (!account || timeAt < account.createdAt) return null;
    if (gone && timeAt >= gone.closedAt) return null;
    // Binary search for the last change at or before timeAt.
    const history = account.history;
    let low = 0;
    let high = history.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (history[middle]![0] <= timeAt) low = middle;
      else high = middle - 1;
    }
    return history[low]![1];
  }
}
