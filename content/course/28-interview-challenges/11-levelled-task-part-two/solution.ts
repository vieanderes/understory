// expiresAt is Infinity for a field with no ttl, so one comparison covers both cases.
interface Entry {
  value: string;
  expiresAt: number;
}

interface Backup {
  timestamp: number;
  // Remaining ttl per field, or Infinity for a field that never expires.
  records: Map<string, Map<string, { value: string; remaining: number }>>;
}

export class Database {
  private records = new Map<string, Map<string, Entry>>();
  private backups: Backup[] = [];

  // Every read goes through here, so expiry is decided in one place.
  private liveRecord(key: string, timestamp: number): Map<string, Entry> {
    const live = new Map<string, Entry>();
    for (const [field, entry] of this.records.get(key) ?? []) {
      if (timestamp < entry.expiresAt) live.set(field, entry);
    }
    return live;
  }

  set(timestamp: number, key: string, field: string, value: string, ttl?: number): void {
    let record = this.records.get(key);
    if (!record) {
      record = new Map();
      this.records.set(key, record);
    }
    const expiresAt = ttl === undefined ? Infinity : timestamp + ttl;
    record.set(field, { value, expiresAt });
  }

  get(timestamp: number, key: string, field: string): string | null {
    const entry = this.records.get(key)?.get(field);
    return entry && timestamp < entry.expiresAt ? entry.value : null;
  }

  delete(timestamp: number, key: string, field: string): boolean {
    if (this.get(timestamp, key, field) === null) return false;
    const record = this.records.get(key)!;
    record.delete(field);
    if (record.size === 0) this.records.delete(key);
    return true;
  }

  scan(timestamp: number, key: string): string[] {
    return this.scanByPrefix(timestamp, key, '');
  }

  scanByPrefix(timestamp: number, key: string, prefix: string): string[] {
    const record = this.liveRecord(key, timestamp);
    const fields = [...record.keys()].filter((field) => field.startsWith(prefix));
    fields.sort();
    return fields.map((field) => `${field}(${record.get(field)!.value})`);
  }

  backup(timestamp: number): number {
    const saved: Backup['records'] = new Map();
    for (const key of this.records.keys()) {
      const live = this.liveRecord(key, timestamp);
      if (live.size === 0) continue;
      const copy = new Map<string, { value: string; remaining: number }>();
      for (const [field, entry] of live) {
        copy.set(field, { value: entry.value, remaining: entry.expiresAt - timestamp });
      }
      saved.set(key, copy);
    }
    this.backups.push({ timestamp, records: saved });
    return saved.size;
  }

  restore(timestamp: number, backupTimestamp: number): void {
    let chosen: Backup | undefined;
    for (const backup of this.backups) {
      if (backup.timestamp <= backupTimestamp) chosen = backup;
    }
    if (!chosen) return;
    this.records = new Map();
    for (const [key, fields] of chosen.records) {
      const record = new Map<string, Entry>();
      for (const [field, saved] of fields) {
        record.set(field, { value: saved.value, expiresAt: timestamp + saved.remaining });
      }
      this.records.set(key, record);
    }
  }
}
