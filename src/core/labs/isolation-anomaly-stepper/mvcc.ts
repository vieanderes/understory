import type { CommitStatus, Row, TableSchema, Value, Version } from './types';

export function rowId(table: string, key: Value): string {
  return `${table}/${String(key)}`;
}

/**
 * A snapshot is the set of transactions whose commits it can see. Taking one "now" means
 * listing what the commit log says is committed. (PostgreSQL stores xmin, xmax and the
 * in-progress list instead; with three transaction ids the set is the same information.)
 */
export function takeSnapshot(clog: Readonly<Record<number, CommitStatus>>): number[] {
  return Object.keys(clog)
    .map(Number)
    .filter((xid) => clog[xid] === 'committed')
    .sort((a, b) => a - b);
}

/**
 * MVCC visibility. A version is visible when its creator is this transaction or is in the
 * snapshot, and its deleter is neither. An aborted or still running creator is never in a
 * snapshot, which is why PostgreSQL has no dirty reads at any level (13.2: "PostgreSQL's
 * Read Uncommitted mode behaves like Read Committed").
 */
export function isVisible(version: Version, snapshot: readonly number[], self: number): boolean {
  const sees = (xid: number) => xid === self || snapshot.includes(xid);
  if (!sees(version.xmin)) return false;
  return version.xmax === null || !sees(version.xmax);
}

export function visibleVersions(
  versions: readonly Version[],
  table: string,
  snapshot: readonly number[],
  self: number,
): Version[] {
  return versions.filter((v) => v.table === table && isVisible(v, snapshot, self));
}

function byKey(a: Version, b: Version): number {
  if (typeof a.key === 'number' && typeof b.key === 'number') return a.key - b.key;
  return String(a.key) < String(b.key) ? -1 : 1;
}

/** The committed state: what a snapshot taken now, by nobody in particular, would see. */
export function committedTables(
  tables: readonly TableSchema[],
  versions: readonly Version[],
  clog: Readonly<Record<number, CommitStatus>>,
): Record<string, Row[]> {
  const snapshot = takeSnapshot(clog);
  const out: Record<string, Row[]> = {};
  for (const table of tables) {
    out[table.name] = visibleVersions(versions, table.name, snapshot, -1)
      .sort(byKey)
      .map((v) => v.values);
  }
  return out;
}
