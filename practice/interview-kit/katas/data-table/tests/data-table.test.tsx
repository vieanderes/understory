// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTableState,
  DataTable,
  DEFAULT_STATE,
  parseTableState,
  serializeTableState,
  type Column,
  type TableState,
} from '../src/data-table';

interface Order {
  id: string;
  customer: string;
  city: string;
  total: number;
}

const columns: Column<Order>[] = [
  { key: 'id', header: 'Order' },
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'city', header: 'City', sortable: true },
  { key: 'total', header: 'Total', sortable: true },
];

const orders: Order[] = [
  { id: 'o1', customer: 'Ada', city: 'Berlin', total: 120 },
  { id: 'o2', customer: 'Ben', city: 'Lisbon', total: 9 },
  { id: 'o3', customer: 'Cleo', city: 'Berlin', total: 75 },
  { id: 'o4', customer: 'Dev', city: 'Oslo', total: 1000 },
  { id: 'o5', customer: 'Eli', city: 'Lisbon', total: 75 },
];

const state = (partial: Partial<TableState>): TableState => ({ ...DEFAULT_STATE, ...partial });

afterEach(cleanup);

describe('URL state', () => {
  it('parses a full query string', () => {
    expect(parseTableState('?sort=total&dir=desc&q=berlin&page=2&size=25')).toEqual({
      sort: { key: 'total', dir: 'desc' },
      q: 'berlin',
      page: 2,
      size: 25,
    });
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseTableState('')).toEqual(DEFAULT_STATE);
    expect(parseTableState('page=0&size=7&dir=sideways&sort=city')).toEqual({
      ...DEFAULT_STATE,
      sort: { key: 'city', dir: 'asc' },
    });
    expect(parseTableState('page=abc').page).toBe(1);
    expect(parseTableState('page=1.5').page).toBe(1);
  });

  it('serialises without defaults and round-trips', () => {
    expect(serializeTableState(DEFAULT_STATE)).toBe('');
    const custom = state({ sort: { key: 'total', dir: 'desc' }, q: 'a b&c', page: 3, size: 50 });
    expect(parseTableState(serializeTableState(custom))).toEqual(custom);
  });
});

describe('applyTableState', () => {
  it('filters case-insensitively across columns', () => {
    const view = applyTableState(orders, columns, state({ q: 'BERL' }));
    expect(view.rows.map((o) => o.id)).toEqual(['o1', 'o3']);
    expect(view.total).toBe(2);
  });

  it('sorts numbers numerically, not as strings', () => {
    const view = applyTableState(orders, columns, state({ sort: { key: 'total', dir: 'asc' } }));
    expect(view.rows.map((o) => o.total)).toEqual([9, 75, 75, 120, 1000]);
  });

  it('sorts descending and keeps equal keys in their original order', () => {
    const view = applyTableState(orders, columns, state({ sort: { key: 'city', dir: 'desc' } }));
    expect(view.rows.map((o) => o.id)).toEqual(['o4', 'o2', 'o5', 'o1', 'o3']);
  });

  it('pages and clamps a page past the end to the last page', () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ ...orders[0]!, id: `x${i}` }));
    const view = applyTableState(many, columns, state({ page: 9 }));
    expect(view).toMatchObject({ page: 3, pageCount: 3, total: 23 });
    expect(view.rows.map((o) => o.id)).toEqual(['x20', 'x21', 'x22']);
  });

  it('reports one empty page when nothing matches', () => {
    expect(applyTableState(orders, columns, state({ q: 'nowhere' }))).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });
});

/** Holds the state the way a router would, and exposes the latest URL for assertions. */
function Harness({ initial, rows }: { initial: string; rows: Order[] }) {
  const [search, setSearch] = useState(initial);
  return (
    <>
      <DataTable
        caption="Orders"
        rows={rows}
        columns={columns}
        state={parseTableState(search)}
        onStateChange={(next) => setSearch(serializeTableState(next))}
        getRowId={(o) => o.id}
      />
      <output data-testid="url">{search}</output>
    </>
  );
}

function bodyRows() {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body!)
    .getAllByRole('row')
    .map((row) => row.textContent);
}

describe('DataTable', () => {
  it('renders a captioned table with column headers', () => {
    render(<Harness initial="" rows={orders} />);
    expect(screen.getByRole('table', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Order',
      'Customer',
      'City',
      'Total',
    ]);
  });

  it('cycles sort through ascending, descending and none, with aria-sort on the header', async () => {
    const user = userEvent.setup();
    render(<Harness initial="" rows={orders} />);
    const header = () => screen.getByRole('columnheader', { name: 'Total' });
    expect(header()).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyRows()[0]).toContain('Ben');
    expect(screen.getByTestId('url')).toHaveTextContent('sort=total');

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRows()[0]).toContain('Dev');

    await user.click(screen.getByRole('button', { name: 'Total' }));
    expect(header()).not.toHaveAttribute('aria-sort');
    expect(screen.getByTestId('url')).toBeEmptyDOMElement();
  });

  it('does not offer sorting on a column that is not sortable', () => {
    render(<Harness initial="" rows={orders} />);
    expect(screen.queryByRole('button', { name: 'Order' })).toBeNull();
  });

  it('filters, resets to page 1, and shows an empty state', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) => ({ ...orders[i % 5]!, id: `r${i}` }));
    render(<Harness initial="page=2" rows={many} />);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Filter' }), 'oslo');
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(6);
    expect(screen.getByTestId('url')).toHaveTextContent('q=oslo');

    await user.type(screen.getByRole('searchbox', { name: 'Filter' }), 'zzz');
    expect(bodyRows()).toEqual(['No matching rows']);
  });

  it('pages with Previous and Next, disabled at the ends', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, i) => ({ ...orders[0]!, id: `r${i}` }));
    render(<Harness initial="" rows={many} />);
    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(previous).toBeDisabled();

    await user.click(next);
    await user.click(next);
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByTestId('url')).toHaveTextContent('page=3');
  });

  it('restores its view from a shared URL', () => {
    render(<Harness initial="sort=customer&dir=desc&q=lisbon" rows={orders} />);
    expect(screen.getByRole('searchbox', { name: 'Filter' })).toHaveValue('lisbon');
    expect(bodyRows().map((text) => text?.slice(0, 2))).toEqual(['o5', 'o2']);
  });
});
