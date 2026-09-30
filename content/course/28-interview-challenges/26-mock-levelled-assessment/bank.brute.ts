// Correct, but every operation scans every pending payment, and getBalance scans the
// whole history. Both are O(N) per call, so 50,000 operations cost O(N^2).
interface Account {
  balance: number;
  outgoing: number;
  history: { time: number; balance: number }[];
  createdAt: number;
  closedAt: number;
}

interface Payment {
  id: string;
  owner: string;
  amount: number;
  due: number;
}

export class Bank {
  private accounts = new Map<string, Account>();
  private pending: Payment[] = [];
  private scheduled = 0;

  private live(accountId: string): Account | undefined {
    const account = this.accounts.get(accountId);
    return account && account.closedAt === Infinity ? account : undefined;
  }

  private runDue(timestamp: number): void {
    // filter keeps the order of scheduling, and the sort is stable.
    const due = this.pending.filter((p) => p.due <= timestamp).sort((a, b) => a.due - b.due);
    this.pending = this.pending.filter((p) => p.due > timestamp);
    for (const payment of due) {
      const account = this.live(payment.owner)!;
      if (account.balance >= payment.amount) {
        account.balance -= payment.amount;
        account.outgoing += payment.amount;
        account.history.push({ time: payment.due, balance: account.balance });
      }
    }
  }

  createAccount(timestamp: number, accountId: string): boolean {
    this.runDue(timestamp);
    if (this.accounts.has(accountId)) return false;
    this.accounts.set(accountId, {
      balance: 0,
      outgoing: 0,
      history: [{ time: timestamp, balance: 0 }],
      createdAt: timestamp,
      closedAt: Infinity,
    });
    return true;
  }

  deposit(timestamp: number, accountId: string, amount: number): number | null {
    this.runDue(timestamp);
    const account = this.live(accountId);
    if (!account) return null;
    account.balance += amount;
    account.history.push({ time: timestamp, balance: account.balance });
    return account.balance;
  }

  transfer(timestamp: number, sourceId: string, targetId: string, amount: number): number | null {
    this.runDue(timestamp);
    const source = this.live(sourceId);
    const target = this.live(targetId);
    if (!source || !target || source === target || source.balance < amount) return null;
    source.balance -= amount;
    source.outgoing += amount;
    target.balance += amount;
    source.history.push({ time: timestamp, balance: source.balance });
    target.history.push({ time: timestamp, balance: target.balance });
    return source.balance;
  }

  topSpenders(timestamp: number, n: number): string[] {
    this.runDue(timestamp);
    const rows: { id: string; total: number }[] = [];
    for (const [id, account] of this.accounts) {
      if (account.closedAt === Infinity) rows.push({ id, total: account.outgoing });
    }
    rows.sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : 1));
    return rows.slice(0, n).map((row) => `${row.id}(${row.total})`);
  }

  schedulePayment(timestamp: number, accountId: string, amount: number, delay: number): string | null {
    this.runDue(timestamp);
    if (!this.live(accountId)) return null;
    this.scheduled += 1;
    const id = `payment${this.scheduled}`;
    this.pending.push({ id, owner: accountId, amount, due: timestamp + delay });
    return id;
  }

  cancelPayment(timestamp: number, accountId: string, paymentId: string): boolean {
    this.runDue(timestamp);
    const index = this.pending.findIndex((p) => p.id === paymentId && p.owner === accountId);
    if (index === -1) return false;
    this.pending.splice(index, 1);
    return true;
  }

  mergeAccounts(timestamp: number, accountId1: string, accountId2: string): boolean {
    this.runDue(timestamp);
    const kept = this.live(accountId1);
    const merged = this.live(accountId2);
    if (!kept || !merged || kept === merged) return false;
    kept.balance += merged.balance;
    kept.outgoing += merged.outgoing;
    kept.history.push({ time: timestamp, balance: kept.balance });
    for (const payment of this.pending) {
      if (payment.owner === accountId2) payment.owner = accountId1;
    }
    merged.closedAt = timestamp;
    return true;
  }

  getBalance(timestamp: number, accountId: string, timeAt: number): number | null {
    this.runDue(timestamp);
    const account = this.accounts.get(accountId);
    if (!account || timeAt < account.createdAt || timeAt >= account.closedAt) return null;
    const earlier = account.history.filter((entry) => entry.time <= timeAt);
    return earlier[earlier.length - 1]!.balance;
  }
}
