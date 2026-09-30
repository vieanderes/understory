export type TxResult = 'OK' | 'NO TRANSACTION';

export class TxStore {
  #data = new Map<string, string>();

  get(key: string): string | undefined {
    return this.#data.get(key);
  }

  set(key: string, value: string): void {
    this.#data.set(key, value);
  }

  delete(key: string): boolean {
    return this.#data.delete(key);
  }

  count(value: string): number {
    // Scanning every key works, but it's too slow once the store is large.
    let total = 0;
    for (const stored of this.#data.values()) if (stored === value) total++;
    return total;
  }

  begin(): void {
    // Open a change set.
  }

  rollback(): TxResult {
    return 'NO TRANSACTION';
  }

  commit(): TxResult {
    return 'NO TRANSACTION';
  }
}
