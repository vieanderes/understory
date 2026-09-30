import type { ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

export interface TableState {
  sort: { key: string; dir: SortDir } | null;
  q: string;
  page: number;
  size: 10 | 25 | 50;
}

export interface Column<Row> {
  key: keyof Row & string;
  header: string;
  sortable?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface TableView<Row> {
  rows: Row[];
  total: number;
  page: number;
  pageCount: number;
}

export const DEFAULT_STATE: TableState = { sort: null, q: '', page: 1, size: 10 };

const SIZES = [10, 25, 50] as const;

function isSize(value: number): value is TableState['size'] {
  return (SIZES as readonly number[]).includes(value);
}

export function parseTableState(search: string): TableState {
  const params = new URLSearchParams(search);
  const key = params.get('sort');
  const dir: SortDir = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    sort: key ? { key, dir } : null,
    q: params.get('q') ?? '',
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_STATE.page,
    size: isSize(size) ? size : DEFAULT_STATE.size,
  };
}

export function serializeTableState(state: TableState): string {
  const params = new URLSearchParams();
  if (state.sort) {
    params.set('sort', state.sort.key);
    if (state.sort.dir === 'desc') params.set('dir', 'desc');
  }
  if (state.q) params.set('q', state.q);
  if (state.page !== DEFAULT_STATE.page) params.set('page', String(state.page));
  if (state.size !== DEFAULT_STATE.size) params.set('size', String(state.size));
  return params.toString();
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

export function applyTableState<Row>(
  rows: readonly Row[],
  columns: ReadonlyArray<Column<Row>>,
  state: TableState,
): TableView<Row> {
  const needle = state.q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) =>
        columns.some((column) =>
          String(row[column.key] ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      )
    : [...rows];

  const sort = state.sort;
  const column = sort && columns.find((c) => c.key === sort.key && c.sortable);
  if (sort && column) {
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Array.prototype.sort is stable, so equal keys keep their original order.
    filtered.sort((a, b) => sign * compare(a[column.key], b[column.key]));
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / state.size));
  // A shared link can outlive the data it pointed at; show the last page, not an empty one.
  const page = Math.min(state.page, pageCount);
  const start = (page - 1) * state.size;
  return {
    rows: filtered.slice(start, start + state.size),
    total: filtered.length,
    page,
    pageCount,
  };
}

export interface DataTableProps<Row> {
  rows: readonly Row[];
  columns: ReadonlyArray<Column<Row>>;
  state: TableState;
  onStateChange: (next: TableState) => void;
  caption: string;
  getRowId: (row: Row) => string;
}

function nextSort(current: TableState['sort'], key: string): TableState['sort'] {
  if (current?.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return null;
}

export function DataTable<Row>({
  rows,
  columns,
  state,
  onStateChange,
  caption,
  getRowId,
}: DataTableProps<Row>) {
  const view = applyTableState(rows, columns, state);

  return (
    <div>
      <label>
        Filter
        <input
          type="search"
          value={state.q}
          onChange={(event) => onStateChange({ ...state, q: event.target.value, page: 1 })}
        />
      </label>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = state.sort?.key === column.key ? state.sort.dir : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                  }
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        onStateChange({ ...state, sort: nextSort(state.sort, column.key), page: 1 })
                      }
                    >
                      {column.header}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {view.rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No matching rows</td>
            </tr>
          ) : (
            view.rows.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <nav aria-label="Pagination">
        <button
          type="button"
          disabled={view.page <= 1}
          onClick={() => onStateChange({ ...state, page: view.page - 1 })}
        >
          Previous
        </button>
        <span>
          Page {view.page} of {view.pageCount}
        </span>
        <button
          type="button"
          disabled={view.page >= view.pageCount}
          onClick={() => onStateChange({ ...state, page: view.page + 1 })}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
