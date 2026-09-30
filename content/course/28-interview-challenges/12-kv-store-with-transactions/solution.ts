export type TxResult = 'OK' | 'NO TRANSACTION';

// Each open transaction is a change set: the value every touched key had before it was first
// touched in that transaction, with `undefined` for a key that did not exist. Values are
// counted as they change, so `count` never scans the whole store.
export class TxStore {
  #data = new Map<string, string>();
  #counts = new Map<string, number>();
  #stack: Map<string, string | undefined>[] = [];

  get(key: string): string | undefined {
    return this.#data.get(key);
  }

  set(key: string, value: string): void {
    this.#record(key);
    this.#write(key, value);
  }

  delete(key: string): boolean {
    if (!this.#data.has(key)) return false;
    this.#record(key);
    this.#write(key, undefined);
    return true;
  }

  count(value: string): number {
    return this.#counts.get(value) ?? 0;
  }

  begin(): void {
    this.#stack.push(new Map());
  }

  rollback(): TxResult {
    const changes = this.#stack.pop();
    if (changes === undefined) return 'NO TRANSACTION';
    for (const [key, old] of changes) this.#write(key, old);
    return 'OK';
  }

  commit(): TxResult {
    const changes = this.#stack.pop();
    if (changes === undefined) return 'NO TRANSACTION';
    const parent = this.#stack.at(-1);
    if (parent !== undefined) {
      // The parent keeps its own, older value for a key it had already touched.
      for (const [key, old] of changes) if (!parent.has(key)) parent.set(key, old);
    }
    return 'OK';
  }

  #record(key: string): void {
    const changes = this.#stack.at(-1);
    if (changes !== undefined && !changes.has(key)) changes.set(key, this.#data.get(key));
  }

  #write(key: string, value: string | undefined): void {
    const before = this.#data.get(key);
    if (before !== undefined) this.#counts.set(before, (this.#counts.get(before) ?? 0) - 1);
    if (value === undefined) {
      this.#data.delete(key);
    } else {
      this.#data.set(key, value);
      this.#counts.set(value, (this.#counts.get(value) ?? 0) + 1);
    }
  }
}
