'use client';

import { useState } from 'react';
import type { CompiledTraceTableStep } from '@/core/content/compiled';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { CodeView } from '../parts/CodeView';
import { Feedback } from '../parts/Feedback';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';
import { VerdictMark } from '../parts/VerdictMark';

/** From this many columns on, a 390 px screen cannot hold the table, so it scrolls in place. */
const SCROLLS_FROM_COLUMNS = 4;

function perCellOf(detail: unknown): readonly (readonly (boolean | undefined)[])[] {
  if (typeof detail !== 'object' || detail === null || !('perCell' in detail)) return [];
  return (detail as { perCell: boolean[][] }).perCell;
}

/**
 * trace-table: run the code by hand and write each variable down, line by line. Tracing
 * on paper is the strongest predictor of later code-writing skill (Lister et al. 2004),
 * so the table is a real table and the cells are plain inputs: nothing to learn but the
 * code.
 */
export function TraceTableStep({
  step,
  phase,
  grade,
  reveal,
  onSubmissionChange,
}: StepProps<CompiledTraceTableStep>) {
  // Given rows hold their values from the start, so the grader sees one full grid.
  const [cells, setCells] = useState<string[][]>(() =>
    step.rows.map((row) => (row.given ? [...row.values] : row.values.map(() => ''))),
  );
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);

  const checked = phase === 'checked';
  const perCell = perCellOf(grade?.detail);
  const activeLine = hoverLine ?? focusLine;

  function write(rowIndex: number, colIndex: number, value: string) {
    const next = cells.map((row, r) =>
      r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
    );
    setCells(next);
    const complete = step.rows.every(
      (row, r) => row.given || row.values.every((_, c) => (next[r]?.[c] ?? '').trim() !== ''),
    );
    onSubmissionChange(complete ? { type: 'trace-table', cells: next } : null);
  }

  const open = step.rows.filter((row) => !row.given);
  const total = open.reduce((n, row) => n + row.values.length, 0);
  const rightCount = perCell.flat().filter((ok) => ok === true).length;
  const scrolls = step.columns.length >= SCROLLS_FROM_COLUMNS;

  return (
    <StepLayout
      question={<RichText value={step.prompt} className="t-section" />}
      split="even"
      code={
        <CodeView
          html={step.codeHtml}
          label="Code to trace"
          picked={activeLine === null ? [] : [activeLine]}
        />
      }
    >
      <div
        // A wide table scrolls inside itself, never the page, and a region that scrolls
        // has to be reachable by keyboard.
        {...(scrolls ? { role: 'region', 'aria-label': 'Trace table', tabIndex: 0 } : {})}
        className={cn('min-w-0', scrolls && 'overflow-x-auto')}
      >
        <table className="w-full border-collapse">
          <caption className="sr-only">Values after each line</caption>
          <thead>
            <tr>
              <th scope="col" className="text-muted w-6 py-1 text-left text-sm font-normal">
                Line
              </th>
              {step.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="text-muted py-1 pl-1 text-left font-mono text-sm font-normal"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {step.rows.map((row, r) => (
              <tr
                key={r}
                className={cn(
                  // A rule above each row, none below the last: the feedback panel brings
                  // its own, and two hairlines a finger apart read as a mistake.
                  'rule-t transition-colors duration-150 ease-out',
                  activeLine === row.line && 'bg-surface',
                )}
                onMouseEnter={() => setHoverLine(row.line)}
                onMouseLeave={() => setHoverLine(null)}
                onFocus={() => setFocusLine(row.line)}
                onBlur={() => setFocusLine(null)}
              >
                <th scope="row" className="t-figure text-muted py-1 text-left text-sm font-normal">
                  {row.line}
                </th>
                {row.values.map((expected, c) => {
                  const name = `${step.columns[c] ?? ''} after line ${row.line}`;
                  if (row.given) {
                    return (
                      <td key={c} className="h-7 py-1 pl-1 font-mono">
                        {expected}
                      </td>
                    );
                  }
                  const ok = checked ? perCell[r]?.[c] === true : null;
                  return (
                    <td key={c} className="py-1 pl-1 align-top">
                      <div className="flex items-center gap-0.5">
                        <input
                          value={cells[r]?.[c] ?? ''}
                          onChange={(e) => write(r, c, e.target.value)}
                          readOnly={checked}
                          aria-label={name}
                          aria-invalid={ok === false || undefined}
                          inputMode="text"
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          // 16 px: iOS zooms the page when a smaller input takes focus.
                          className={cn(
                            'rounded-control bg-surface h-5 w-full min-w-0 border px-1 font-mono text-base',
                            'transition-colors duration-150 ease-out',
                            ok === null && 'border-border hover:border-faint',
                            ok === true && 'border-success',
                            ok === false && 'border-danger',
                          )}
                        />
                        {ok === null ? null : <VerdictMark right={ok} />}
                      </div>
                      {ok === false && reveal ? (
                        <p className="pt-0.5 text-sm">
                          <span className="text-muted">Expected </span>
                          <span className="font-mono">{expected}</span>
                        </p>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {checked && grade ? (
        <Feedback verdict={grade.correct ? 'right' : rightCount > 0 ? 'partly' : 'wrong'}>
          <p>
            {rightCount} of {total} cells right.
            {grade.correct || reveal ? '' : ' The marked cells are wrong. Trace those lines again.'}
          </p>
        </Feedback>
      ) : null}
    </StepLayout>
  );
}
