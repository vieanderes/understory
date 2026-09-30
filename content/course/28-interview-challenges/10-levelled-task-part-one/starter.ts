// Level 1: set, get and delete. Level 2: scan and scanByPrefix.
// Pick a data model that level 3 can add expiry times to.
export class Database {
  set(key: string, field: string, value: string): void {}

  get(key: string, field: string): string | null {
    return null;
  }

  delete(key: string, field: string): boolean {
    return false;
  }

  scan(key: string): string[] {
    return [];
  }

  scanByPrefix(key: string, prefix: string): string[] {
    return [];
  }
}
