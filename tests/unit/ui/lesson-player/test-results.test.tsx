import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunResult } from '@/core/ports/code-runner';
import { statusLine, TestResults } from '@/features/lesson-player/parts/TestResults';

const PASSED: RunResult = {
  status: 'passed',
  tests: [
    { name: 'adds', passed: true },
    { name: 'adds negatives', passed: true },
  ],
  logs: [],
};

const FAILED: RunResult = {
  status: 'failed',
  tests: [
    { name: 'adds', passed: true },
    { name: 'returns a number', passed: false, message: "Expected 'number', received 'string'" },
    { name: 'adds several', passed: false, message: 'Expected 111, received 3' },
  ],
  logs: ['total 3', 'done'],
};

const TIMEOUT: RunResult = {
  status: 'timeout',
  tests: [],
  logs: ['before the loop'],
  error: { name: 'Timeout', message: 'The run did not finish within 3000 ms.' },
};

const SYNTAX: RunResult = {
  status: 'error',
  tests: [],
  logs: [],
  error: { name: 'SyntaxError', message: 'Unexpected token', line: 4 },
};

function show(result: RunResult | null, running = false) {
  return render(<TestResults result={result} running={running} timeoutMs={3000} />);
}

describe('TestResults', () => {
  it('has a live region before the first run, so later results are announced', () => {
    show(null);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Not run yet');
    expect(status).toHaveAttribute('data-status', 'idle');
  });

  it('says that a run is under way', () => {
    show(null, true);
    expect(screen.getByRole('status')).toHaveTextContent('Running');
  });

  it('lists every test of a passing run and says all pass', () => {
    show(PASSED);
    expect(screen.getByRole('status')).toHaveTextContent('All tests pass');
    const rows = screen.getAllByTestId('test-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Passed')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
  });

  it('counts a failing run and shows each assertion message under its test', () => {
    show(FAILED);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 pass');
    const rows = screen.getAllByTestId('test-row');
    expect(rows.map((row) => row.getAttribute('data-passed'))).toEqual(['true', 'false', 'false']);
    const second = within(rows[1] as HTMLElement);
    expect(second.getByText('Failed')).toBeInTheDocument();
    expect(second.getByText("Expected 'number', received 'string'")).toHaveClass('font-mono');
  });

  it('keeps console output collapsed, with the line count', () => {
    show(FAILED);
    const summary = screen.getByText('Console').closest('summary');
    expect(summary).toHaveTextContent('2 lines');
    expect(summary?.parentElement).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Console output')).toHaveTextContent('total 3 done');
  });

  it('explains a timeout in seconds and still shows what was logged', () => {
    show(TIMEOUT);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Timed out after 3 s: look for a loop that never ends',
    );
    expect(screen.queryAllByTestId('test-row')).toHaveLength(0);
    expect(screen.getByText('Console').closest('summary')).toHaveTextContent('1 line');
  });

  it('points a syntax error at its line', () => {
    show(SYNTAX);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Syntax error on line 4: Unexpected token',
    );
  });
});

describe('statusLine', () => {
  it('names a runtime error without a line', () => {
    const result: RunResult = {
      status: 'error',
      tests: [],
      logs: [],
      error: { name: 'ReferenceError', message: 'total is not defined' },
    };
    expect(statusLine(result, 3000)).toBe('Reference error: total is not defined');
  });

  it('lets a sandbox problem speak for itself', () => {
    const result: RunResult = {
      status: 'error',
      tests: [],
      logs: [],
      error: { name: 'SandboxError', message: 'The code tools could not be loaded. Try again.' },
    };
    expect(statusLine(result, 3000)).toBe('The code tools could not be loaded. Try again.');
  });

  it('keeps a fraction of a second', () => {
    expect(statusLine({ status: 'timeout', tests: [], logs: [] }, 2500)).toContain('2.5 s');
  });
});
