import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import BtreeIndexExplorer from '@/features/labs/btree-index-explorer';
import { parsePreset, rowsAtStop, stopForRows } from '@/features/labs/btree-index-explorer/preset';

const stepButton = () => screen.getByRole('button', { name: 'Step' });
const status = () => screen.getByRole('status');
const verdict = () => screen.getByTestId('verdict');

/** A Figure renders its label in a dt and its value in the dd beside it. */
const figure = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

async function stepToEnd(user: ReturnType<typeof userEvent.setup>) {
  while (!stepButton().hasAttribute('disabled')) await user.click(stepButton());
}

describe('BtreeIndexExplorer, the tree', () => {
  it('renders the title, the question, the prediction prompt and the starting tree', () => {
    render(<BtreeIndexExplorer />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'B-tree index explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/reading the whole table is cheaper/)).toBeInTheDocument();
    expect(screen.getByText(/How many pages does finding 471 read/)).toBeInTheDocument();
    expect(figure('Height')).toContain('3');
    expect(figure('Pages in tree')).toContain('11');
    expect(figure('Pages read')).toContain('0');
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(status()).toHaveTextContent('Look up 471. Start at the root, P9.');
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<BtreeIndexExplorer embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('descends one page per level and counts the pages read', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(stepButton());
    expect(status()).toHaveTextContent('471 is below 518: follow the leftmost pointer to P3.');
    expect(figure('Pages read')).toContain('1');
    await stepToEnd(user);
    expect(status()).toHaveTextContent('471 is in leaf P2. 3 pages read');
    expect(figure('Pages read')).toContain('3');
    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(status()).toHaveTextContent('P3: 471 is at least 412: follow the rightmost pointer');
  });

  it('names every page and its keys for a reader who cannot see the drawing', () => {
    render(<BtreeIndexExplorer />);
    const tree = screen.getByRole('region', { name: 'B+ tree pages' });
    expect(tree).toHaveTextContent('Level 1 of 3: P9 holds 518');
    expect(tree).toHaveTextContent('P1 holds 48, 67, 87');
  });

  it('splits a full page and grows the height when a key arrives', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'page-splits');
    expect(figure('Height')).toContain('2');
    expect(figure('Pages in tree')).toContain('6');

    await stepToEnd(user);
    expect(status()).toHaveTextContent('130 inserted. Height 3, 9 pages.');
    expect(figure('Height')).toContain('3');
    expect(figure('Pages in tree')).toContain('9');
  });

  it('inserts a typed key and rejects one the tree already holds', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    await stepToEnd(user);
    expect(status()).toHaveTextContent('505 inserted');

    await user.clear(screen.getByLabelText('Key'));
    await user.type(screen.getByLabelText('Key'), '471');
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    await stepToEnd(user);
    expect(status()).toHaveTextContent('471 is already in P2');
  });

  it('inserts a seeded batch of ten random keys, one step each', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Insert 10 random' }));
    expect(status()).toHaveTextContent('10 inserts queued');
    expect(screen.getByText('Step 1 of 11')).toBeInTheDocument();
    await stepToEnd(user);
    expect(
      screen.getByText('Room for 6 more keys before the drawing stops explaining.'),
    ).toBeInTheDocument();
  });

  it('splits the rightmost page over and over under an ascending run', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Insert ascending run' }));
    await stepToEnd(user);
    expect(status()).toHaveTextContent('968 inserted');
    expect(figure('Pages in tree')).toContain('17');
  });

  it('walks the leaf chain on a range scan instead of descending again', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Range scan' }));
    expect(status()).toHaveTextContent('Scan keys 300 to 520. Descend once, for 300.');
    await user.click(stepButton());
    await user.click(stepButton());
    await user.click(stepButton());
    expect(status()).toHaveTextContent('follow the link to');
    await stepToEnd(user);
    expect(status()).toHaveTextContent(
      'Keys 300 to 520: 333 344 389 412 471 518. 6 pages read: 3 for the one descent, then 3 more along the leaf chain.',
    );
  });

  it('looks a key up and says that it is not there', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    await stepToEnd(user);
    expect(status()).toHaveTextContent('505 is not in leaf');
  });

  it('rebuilds the scenario tree', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('button', { name: 'Insert ascending run' }));
    await stepToEnd(user);
    expect(figure('Pages in tree')).toContain('17');
    await user.click(screen.getByRole('button', { name: 'Rebuild tree' }));
    expect(figure('Pages in tree')).toContain('11');
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('operates the transport from the keyboard', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    stepButton().focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
  });

  it('changes the scenario by keyboard and starts again', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    const select = screen.getByLabelText('Scenario');
    select.focus();
    // jsdom does not move a select on arrow keys, so the keyboard path is completed by value.
    await user.keyboard('{ArrowDown}');
    await user.selectOptions(select, 'Everything that is paid');
    expect(screen.getByText(/Will the planner use it/)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
  });
});

describe('BtreeIndexExplorer, the cost', () => {
  it('prefers the index for one row in a million and says what it reads', () => {
    render(<BtreeIndexExplorer />);
    expect(verdict()).toHaveTextContent('Index Scan using orders_pkey on orders');
    expect(verdict()).toHaveTextContent('Seq Scan on orders');
    expect(verdict()).toHaveTextContent('1 of 1,000,000 rows match, 1 row in 1,000,000.');
    const table = screen.getByRole('table', { name: /Pages read/ });
    expect(within(table).getByRole('row', { name: /Seq Scan on orders/ })).toHaveTextContent(
      '10,000',
    );
    expect(within(table).getByRole('row', { name: /Index Scan/ })).toHaveTextContent('5');
  });

  it('turns the verdict over when the predicate matches most of the table', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.selectOptions(screen.getByLabelText('Query'), 'paid');
    expect(verdict()).toHaveTextContent('900,000 of 1,000,000 rows match, 90%.');
    expect(verdict()).toHaveTextContent('The planner rightly ignores the index.');
    expect(screen.getByTestId('plan-chosen')).toHaveTextContent('Seq Scan on orders');
  });

  it('turns the verdict over when the table is small', () => {
    render(<BtreeIndexExplorer />);
    // jsdom does not step a range input on arrow keys, so the slider is moved by value.
    fireEvent.change(screen.getByLabelText('Rows in orders'), { target: { value: '30' } });
    expect(verdict()).toHaveTextContent('1 of 1,000 rows match');
    expect(screen.getByTestId('plan-chosen')).toHaveTextContent('Seq Scan on orders');
  });

  it('reads no heap page at all when the query wants only indexed columns', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByRole('checkbox'));
    expect(verdict()).toHaveTextContent('Index Only Scan using orders_pkey on orders');
    expect(verdict()).toHaveTextContent('no heap fetches');
    expect(screen.getByText(/SELECT shop_id, created_at FROM orders/)).toBeInTheDocument();
  });

  it('says why an index on the bare column cannot serve lower(email)', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.selectOptions(screen.getByLabelText('Query'), 'lower-email');
    expect(screen.getByLabelText('Index')).toHaveValue('email');
    expect(verdict()).toHaveTextContent('Seq Scan on orders');
    expect(verdict()).toHaveTextContent('cannot look up the result of a function');
    expect(screen.getByRole('img', { name: /No index serves this predicate/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Index'), 'lower-email');
    expect(verdict()).toHaveTextContent('Index Scan using orders_lower_email_idx on orders');
  });

  it('charges a column order that scatters the entries of one shop', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.selectOptions(screen.getByLabelText('Query'), 'event-newest');
    expect(verdict()).toHaveTextContent(
      'Index Scan Backward using orders_shop_created_idx on orders',
    );
    await user.selectOptions(screen.getByLabelText('Index'), 'created-event');
    expect(verdict()).toHaveTextContent('It passes 10,000 entries to keep 20.');
  });

  it('draws the crossover on the chart', () => {
    render(<BtreeIndexExplorer />);
    expect(
      screen.getByRole('img', { name: /the index scan costs 20 against 10,000/ }),
    ).toHaveAccessibleName(/The lines cross at 0.25%/);
  });
});

describe('preset', () => {
  it('starts from the scenario, the row count and the query a lesson names', () => {
    render(
      <BtreeIndexExplorer
        preset={{ scenario: 'all-paid', rows: 10_000_000, query: 'paid', hideSwitcher: true }}
      />,
    );
    expect(screen.queryByLabelText('Scenario')).toBeNull();
    expect(screen.getByLabelText('Query')).toHaveValue('paid');
    expect(verdict()).toHaveTextContent('9,000,000 of 10,000,000 rows match');
  });

  it('falls back to the default scenario on anything invalid', () => {
    render(<BtreeIndexExplorer preset={{ scenario: 'no-such-thing', rows: 'lots' }} />);
    expect(screen.getByLabelText('Scenario')).toHaveValue('lookup-by-id');
    expect(parsePreset({ rows: 12 }).scenario.id).toBe('lookup-by-id');
    expect(parsePreset(undefined).hideSwitcher).toBe(false);
  });

  it('maps the row slider onto whole figures a decade at a time', () => {
    expect(rowsAtStop(30)).toBe(1_000);
    expect(rowsAtStop(70)).toBe(10_000_000);
    expect(stopForRows(1_000_000)).toBe(60);
    expect(stopForRows(50)).toBe(30);
  });
});

describe('what this leaves out', () => {
  it('names deletion, concurrency, MVCC, bitmap scans, statistics and caching', async () => {
    const user = userEvent.setup();
    render(<BtreeIndexExplorer />);
    await user.click(screen.getByText('What this leaves out'));
    expect(screen.getByText(/Deletion and page merging/)).toBeInTheDocument();
    expect(screen.getByText(/right-link and a high key/)).toBeInTheDocument();
    expect(screen.getByText(/Visibility maps and MVCC/)).toBeInTheDocument();
    expect(screen.getByText(/Bitmap scans/)).toBeInTheDocument();
    expect(screen.getByText(/sampled histograms/)).toBeInTheDocument();
    expect(screen.getByText(/upper levels of a hot index/)).toBeInTheDocument();
  });
});
