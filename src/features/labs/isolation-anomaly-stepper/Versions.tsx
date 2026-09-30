import {
  TX_IDS,
  isVisible,
  rowId,
  takeSnapshot,
  tableValues,
  type EngineState,
  type TableSchema,
  type TxId,
} from '@/core/labs/isolation-anomaly-stepper';
import { cn } from '@/lib/cn';

interface VersionsProps {
  tables: readonly TableSchema[];
  state: EngineState;
  className?: string;
}

/**
 * The snapshot a transaction's next read would use: a fresh one under READ COMMITTED
 * (13.2.1), the one its first query took under the stricter levels (13.2.2). Null once
 * the transaction has ended, because it reads nothing more.
 */
function nextSnapshot(state: EngineState, tx: TxId): readonly number[] | null {
  const t = state.txs[tx];
  if (t.status === 'committed' || t.status === 'rolled-back') return null;
  if (state.level === 'read-committed') return takeSnapshot(state.clog);
  return t.snapshot ?? takeSnapshot(state.clog);
}

function xidText(xid: number | null): string {
  if (xid === null) return '';
  return xid === 0 ? 'setup' : `T${xid}`;
}

/** Every row version the database keeps, and which transaction would see it now. */
export function Versions({ tables, state, className }: VersionsProps) {
  const snapshots = { 1: nextSnapshot(state, 1), 2: nextSnapshot(state, 2) };
  return (
    <section aria-label="Row versions" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="t-label">Row versions</h2>
      {tables.map((table) => {
        const versions = state.versions.filter((v) => v.table === table.name);
        const newest = new Map(versions.map((v) => [String(v.key), v]));
        return (
          <div
            key={table.name}
            role="region"
            aria-label={`Versions of ${table.name}`}
            tabIndex={0}
            className="border-border bg-bg rounded-control overflow-x-auto border"
          >
            <table className="w-full text-sm">
              <caption className="t-label px-1 pt-1 text-left">{table.name}</caption>
              <thead>
                <tr className="rule-b">
                  {[...table.columns, 'xmin', 'xmax'].map((col) => (
                    <th key={col} scope="col" className="t-label px-1 py-0.5 text-left">
                      {col}
                    </th>
                  ))}
                  {TX_IDS.map((tx) => (
                    <th key={tx} scope="col" className="t-label px-1 py-0.5 text-left">
                      {`T${tx} sees`}
                    </th>
                  ))}
                  <th scope="col" className="t-label px-1 py-0.5 text-left">
                    Lock
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version, index) => {
                  const creator = state.clog[version.xmin];
                  const lock = state.locks[rowId(table.name, version.key)];
                  const isNewest = newest.get(String(version.key)) === version;
                  return (
                    <tr
                      key={index}
                      data-testid="version"
                      className={cn(creator === 'aborted' && 'text-muted')}
                    >
                      {tableValues(table, version.values).map((value, i) => (
                        <td key={i} className="t-figure px-1 py-0.5 whitespace-nowrap">
                          {String(value)}
                        </td>
                      ))}
                      <td className="t-figure px-1 py-0.5 whitespace-nowrap">
                        {xidText(version.xmin)}
                        {creator === 'aborted' ? ' aborted' : ''}
                      </td>
                      <td className="t-figure px-1 py-0.5 whitespace-nowrap">
                        {xidText(version.xmax)}
                      </td>
                      {TX_IDS.map((tx) => {
                        const snapshot = snapshots[tx];
                        const sees = snapshot ? isVisible(version, snapshot, tx) : null;
                        return (
                          <td
                            key={tx}
                            className={cn('px-1 py-0.5', sees ? 'font-medium' : 'text-muted')}
                          >
                            {sees === null ? 'ended' : sees ? 'yes' : 'no'}
                          </td>
                        );
                      })}
                      <td className="t-figure px-1 py-0.5 whitespace-nowrap">
                        {isNewest && lock ? `T${lock}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-muted prose-measure text-sm">
        xmin made a version and xmax replaced or deleted it. A transaction sees a version when it
        can see xmin and cannot see xmax.
      </p>
    </section>
  );
}
