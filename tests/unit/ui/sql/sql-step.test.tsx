import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledSqlStep } from '@/core/content/compiled';
import { gradeSql, type SqlResultSet, type SqlRunReport, type SqlRunRequest } from '@/core/sql';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';
import type { Submission } from '@/features/lesson-player/contract';
import { SqlStep } from '@/features/lesson-player/steps/SqlStep';

// The editor is a plain field here; CodeMirror has its own tests and the e2e suite.
vi.mock('@/features/editor/LazyCodeEditor', () => ({
  // The header row (file tabs, Reset) is drawn by the editor, so the stand-in draws it too.
  LazyCodeEditor: ({ value, onChange, readOnly, ariaLabel, header }: LazyCodeEditorProps) => (
    <>
      {header}
      <textarea
        aria-label={ariaLabel}
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </>
  ),
}));

/** Answers like the worker would, from a table of SQL to reports. Postgres itself is tested in Node. */
const engine = {
  ready: true,
  requests: [] as SqlRunRequest[],
  subscribe: () => () => undefined,
  run: vi.fn((request: SqlRunRequest): Promise<SqlRunReport> => {
    engine.requests.push(request);
    return Promise.resolve(answer(request));
  }),
};

vi.mock('@/features/sql/shared-engine', () => ({
  sqlEngine: () => engine,
  holdSqlEngine: () => () => undefined,
}));

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const orders = (rows: string[][]): SqlResultSet => ({
  columns: ['id', 'customer', 'shipped'],
  rows,
  rowCount: rows.length,
});

const BOTH = [
  ['1', 'Ana', 't'],
  ['2', 'Ben', 'f'],
];

function answer(request: SqlRunRequest): SqlRunReport {
  if (request.describe) {
    return {
      status: 'ran',
      statements: [],
      skipped: 0,
      schema: [
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'integer', notNull: true, primaryKey: true },
            { name: 'customer', type: 'text', notNull: false, primaryKey: false },
          ],
        },
      ],
    };
  }
  const sql = request.sql.trim();
  if (sql.startsWith('selct')) {
    return {
      status: 'ran',
      skipped: 1,
      statements: [
        {
          status: 'error',
          line: 1,
          text: sql,
          error: { message: 'syntax error at or near "selct"', code: '42601', line: 1, column: 1 },
        },
      ],
    };
  }
  const rows = sql.includes('where') ? [['2', 'Ben', 'f']] : BOTH;
  return {
    status: 'ran',
    skipped: 0,
    statements: [
      { status: 'ok', line: 1, text: sql, command: 'SELECT', result: orders(rows), ms: 1 },
    ],
  };
}

const STEP: CompiledSqlStep = {
  type: 'sql',
  id: 'find-unshipped',
  concept: 'db.foreign-keys',
  difficulty: 1,
  prompt: rich('Show every order that has not shipped.'),
  setup: 'create table orders (id int primary key, customer text, shipped boolean);',
  starter: 'select * from orders;',
  solution: 'select * from orders where not shipped;',
  checks: {},
  showSchema: true,
  hints: [rich('Hint one'), rich('Hint two')],
};

function setup(
  props: {
    step?: CompiledSqlStep;
    phase?: 'answering' | 'checked';
    reveal?: boolean;
    grade?: ReturnType<typeof gradeSql>;
  } = {},
) {
  const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
  const view = render(
    <SqlStep
      step={props.step ?? STEP}
      phase={props.phase ?? 'answering'}
      grade={props.grade}
      reveal={props.reveal ?? false}
      seed={1}
      lessonId="db.test"
      onSubmissionChange={onSubmissionChange}
      requestCheck={vi.fn()}
    />,
  );
  return { onSubmissionChange, ...view };
}

async function type(value: string) {
  const field = screen.getByLabelText('Your SQL');
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

beforeEach(() => {
  engine.requests = [];
  engine.run.mockClear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('SqlStep', () => {
  it('shows the tables the setup made, read from the database', async () => {
    setup();
    const table = await screen.findByRole('table', { name: 'orders' });
    expect(within(table).getByRole('rowheader', { name: 'id' })).toBeInTheDocument();
    expect(within(table).getByText('primary key')).toBeInTheDocument();
    expect(engine.requests[0]).toEqual({ setup: STEP.setup, sql: '', describe: true });
  });

  it('runs the SQL and shows the rows in a real table with column headers', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    const result = await screen.findByRole('table', { name: /Result: line 1/ });
    expect(
      within(result)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['id', 'customer', 'shipped']);
    expect(within(result).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('SELECT · 2 rows')).toBeInTheDocument();
    // Every run starts from the step's setup.
    expect(engine.requests.at(-2)).toEqual({ setup: STEP.setup, sql: STEP.starter });
  });

  it('compares each run with the solution and hands the verdict to the player', async () => {
    const { onSubmissionChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('Not the result the task asks for yet.');
    const mismatch = {
      status: 'mismatch' as const,
      differences: ['Expected 1 row, got 2.', 'An extra row: (1, Ana, t).'],
    };
    expect(onSubmissionChange).toHaveBeenLastCalledWith({
      type: 'sql',
      verdict: mismatch,
      grade: gradeSql(mismatch),
      hintsUsed: 0,
    });

    await type('select * from orders where shipped = false;');
    // An edit makes the last verdict stale.
    expect(onSubmissionChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('Same result as the solution');
    expect(onSubmissionChange).toHaveBeenLastCalledWith({
      type: 'sql',
      verdict: { status: 'match' },
      grade: gradeSql({ status: 'match' }),
      hintsUsed: 0,
    });
    // The solution ran once, and is remembered for the step.
    expect(engine.requests.filter((r) => r.sql === STEP.solution)).toHaveLength(1);
  });

  it('shows Postgres’s own error and where it points', async () => {
    setup();
    await type('selct 1;');
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('ERROR: syntax error at or near "selct"')).toBeInTheDocument();
    expect(screen.getByText('Line 1, column 1')).toBeInTheDocument();
    expect(screen.getByText('Stopped at line 1')).toBeInTheDocument();
    expect(screen.getByText('1 statement after it did not run.')).toBeInTheDocument();
  });

  it('counts a hint in the verdict already reported', async () => {
    const { onSubmissionChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('Not the result the task asks for yet.');
    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(onSubmissionChange).toHaveBeenLastCalledWith(expect.objectContaining({ hintsUsed: 1 }));
  });

  it('restores the starter after asking', async () => {
    setup();
    await type('select 1;');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByLabelText('Your SQL')).toHaveValue(STEP.starter);
  });

  it('after a failed attempt, lists what differs and shows the solution with its rows', async () => {
    const { rerender } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('Not the result the task asks for yet.');
    const grade = gradeSql({ status: 'mismatch', differences: ['Expected 1 row, got 2.'] });
    rerender(
      <SqlStep
        step={STEP}
        phase="checked"
        grade={grade}
        reveal
        seed={1}
        lessonId="db.test"
        onSubmissionChange={vi.fn()}
        requestCheck={vi.fn()}
      />,
    );
    expect(screen.getByText('Expected 1 row, got 2.')).toBeInTheDocument();
    expect(screen.getByLabelText('The solution SQL')).toHaveValue(STEP.solution);
    const solved = screen.getByRole('table', { name: /Its result: line 1/ });
    expect(within(solved).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  });

  it('is a database to explore without checks: no verdict, nothing to submit', async () => {
    const { onSubmissionChange } = setup({
      step: { ...STEP, checks: undefined, solution: undefined, showSchema: false },
    });
    expect(screen.queryByRole('heading', { name: 'Tables' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText('SELECT · 2 rows');
    expect(screen.queryByText('Not the result the task asks for yet.')).toBeNull();
    expect(onSubmissionChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(engine.requests.some((r) => r.sql === STEP.solution)).toBe(false));
  });

  it('says the database is not available instead of failing', async () => {
    engine.run.mockImplementationOnce(() =>
      Promise.resolve({ status: 'unavailable', reason: 'The database did not load.' }),
    );
    setup();
    expect(
      await screen.findByText('The tables could not be read. The database did not load.'),
    ).toBeInTheDocument();
  });
});
