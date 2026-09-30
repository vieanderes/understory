// Levels 1 to 4 build on each other. Every method takes the timestamp first.
export class Bank {
  // Level 1
  createAccount(timestamp: number, accountId: string): boolean {
    return false;
  }

  deposit(timestamp: number, accountId: string, amount: number): number | null {
    return null;
  }

  transfer(timestamp: number, sourceId: string, targetId: string, amount: number): number | null {
    return null;
  }

  // Level 2
  topSpenders(timestamp: number, n: number): string[] {
    return [];
  }

  // Level 3
  schedulePayment(timestamp: number, accountId: string, amount: number, delay: number): string | null {
    return null;
  }

  cancelPayment(timestamp: number, accountId: string, paymentId: string): boolean {
    return false;
  }

  // Level 4
  mergeAccounts(timestamp: number, accountId1: string, accountId2: string): boolean {
    return false;
  }

  getBalance(timestamp: number, accountId: string, timeAt: number): number | null {
    return null;
  }
}
