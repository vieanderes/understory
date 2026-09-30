// Your level 1 and 2 store, with a timestamp added to every method.
// The level 1 and 2 tests pass already. Keep them green while you add
// ttl (level 3) and backup and restore (level 4).
export class Database {
  private records = new Map<string, Map<string, { value: string }>>();

  set(timestamp: number, key: string, field: string, value: string, ttl?: number): void {
    let record = this.records.get(key);
    if (!record) {
      record = new Map();
      this.records.set(key, record);
    }
    record.set(field, { value });
  }

  get(timestamp: number, key: string, field: string): string | null {
    return this.records.get(key)?.get(field)?.value ?? null;
  }

  delete(timestamp: number, key: string, field: string): boolean {
    const record = this.records.get(key);
    if (!record || !record.delete(field)) return false;
    if (record.size === 0) this.records.delete(key);
    return true;
  }

  scan(timestamp: number, key: string): string[] {
    return this.scanByPrefix(timestamp, key, '');
  }

  scanByPrefix(timestamp: number, key: string, prefix: string): string[] {
    const record = this.records.get(key);
    if (!record) return [];
    const fields = [...record.keys()].filter((field) => field.startsWith(prefix));
    fields.sort();
    return fields.map((field) => `${field}(${record.get(field)!.value})`);
  }

  backup(timestamp: number): number {
    return 0;
  }

  restore(timestamp: number, backupTimestamp: number): void {}
}
