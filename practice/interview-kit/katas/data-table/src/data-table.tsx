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

export function parseTableState(search: string): TableState {
  void search;
  throw new Error('Not implemented');
}

export function serializeTableState(state: TableState): string {
  void state;
  throw new Error('Not implemented');
}

export function applyTableState<Row>(
  rows: readonly Row[],
  columns: ReadonlyArray<Column<Row>>,
  state: TableState,
): TableView<Row> {
  void rows;
  void columns;
  void state;
  throw new Error('Not implemented');
}

export interface DataTableProps<Row> {
  rows: readonly Row[];
  columns: ReadonlyArray<Column<Row>>;
  state: TableState;
  onStateChange: (next: TableState) => void;
  caption: string;
  getRowId: (row: Row) => string;
}

export function DataTable<Row>({ caption }: DataTableProps<Row>) {
  return (
    <table>
      <caption>{caption}</caption>
    </table>
  );
}
