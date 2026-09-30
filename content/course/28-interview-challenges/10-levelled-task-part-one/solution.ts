// Each field holds an entry object, not a bare string, so level 3 can add an expiry
// time to it without changing any caller.
interface Entry {
  value: string;
}

export class Database {
  private records = new Map<string, Map<string, Entry>>();

  set(key: string, field: string, value: string): void {
    let record = this.records.get(key);
    if (!record) {
      record = new Map();
      this.records.set(key, record);
    }
    record.set(field, { value });
  }

  get(key: string, field: string): string | null {
    return this.records.get(key)?.get(field)?.value ?? null;
  }

  delete(key: string, field: string): boolean {
    const record = this.records.get(key);
    if (!record || !record.delete(field)) return false;
    if (record.size === 0) this.records.delete(key);
    return true;
  }

  scan(key: string): string[] {
    return this.scanByPrefix(key, '');
  }

  scanByPrefix(key: string, prefix: string): string[] {
    const record = this.records.get(key);
    if (!record) return [];
    const fields = [...record.keys()].filter((field) => field.startsWith(prefix));
    // Field names are strings, so the default sort orders them correctly.
    fields.sort();
    return fields.map((field) => `${field}(${record.get(field)!.value})`);
  }
}
