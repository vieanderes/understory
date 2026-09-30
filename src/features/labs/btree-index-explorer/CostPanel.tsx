'use client';

import { useId, useMemo } from 'react';
import {
  costCurve,
  planQuery,
  queryById,
  QUERIES,
  ROWS_PER_PAGE,
} from '@/core/labs/btree-index-explorer';
import { CostChart, figure, share } from './CostChart';
import { rowsAtStop, ROWS_STOP_MAX, ROWS_STOP_MIN } from './preset';
import { Select } from './Select';

/*
 * A short name for each query. The select must stay inside a 390 px column, and the SQL
 * itself is printed underneath, so the option only has to say which question is asked.
 */
const QUERY_LABEL: Record<string, string> = {
  'by-id': 'One order by id',
  'event-paid': 'One shop, paid only',
  paid: 'Every paid order',
  'lower-email': 'Email, lowercased',
  'event-newest': 'One shop, newest 20',
  'like-suffix': 'Email ending in a domain',
};

interface CostPanelProps {
  rowsStop: number;
  onRowsStop: (stop: number) => void;
  queryId: string;
  onQuery: (id: string) => void;
  indexId: string;
  onIndex: (id: string) => void;
  covering: boolean;
  onCovering: (covering: boolean) => void;
}

/**
 * Part two: the same tree at the scale of a real table, where the question is no longer
 * how an index works but whether the planner will use it.
 */
export function CostPanel({
  rowsStop,
  onRowsStop,
  queryId,
  onQuery,
  indexId,
  onIndex,
  covering,
  onCovering,
}: CostPanelProps) {
  const ids = useId();
  const rows = rowsAtStop(rowsStop);
  const query = queryById(queryId);
  const plan = useMemo(
    () => planQuery({ queryId, indexId, rows, covering }),
    [queryId, indexId, rows, covering],
  );
  const points = useMemo(() => costCurve(plan.input), [plan.input]);
  const { cost } = plan;

  return (
    <section aria-labelledby={`${ids}-title`} className="flex min-w-0 flex-col gap-2">
      <h2 id={`${ids}-title`} className="t-label">
        Sequential scan against index scan
      </h2>

      <div className="grid min-w-0 gap-2 md:grid-cols-12 md:gap-x-4">
        <div className="flex min-w-0 flex-col gap-0.5 md:col-span-4">
          <label htmlFor={`${ids}-rows`} className="t-label truncate">
            Rows in orders
          </label>
          <div className="flex h-5 items-center gap-1">
            <input
              id={`${ids}-rows`}
              type="range"
              min={ROWS_STOP_MIN}
              max={ROWS_STOP_MAX}
              step={1}
              value={rowsStop}
              aria-valuetext={`${figure(rows)} rows`}
              onChange={(event) => onRowsStop(Number(event.target.value))}
              className="accent-accent h-5 w-full min-w-0"
            />
            <span className="t-figure w-11 shrink-0 text-right text-sm">{figure(rows)}</span>
          </div>
        </div>
        <Select
          className="md:col-span-5"
          label="Query"
          value={queryId}
          onChange={onQuery}
          options={QUERIES.map((q) => ({ value: q.id, label: QUERY_LABEL[q.id] ?? q.sql }))}
        />
        <Select
          className="md:col-span-3"
          label="Index"
          value={indexId}
          onChange={onIndex}
          options={query.indexes.map((i) => ({ value: i.id, label: i.columns }))}
        />
      </div>

      <pre
        tabIndex={0}
        aria-label="SQL"
        className="t-figure border-border bg-bg rounded-control overflow-x-auto border p-1 text-sm"
      >
        {`SELECT ${covering ? 'shop_id, created_at' : '*'} FROM orders ${query.sql}`}
      </pre>

      <label className="flex min-h-5 cursor-pointer items-center gap-1 text-sm">
        <input
          type="checkbox"
          className="accent-accent size-2"
          checked={covering}
          onChange={(event) => onCovering(event.target.checked)}
        />
        Select only indexed columns, so the heap need not be touched
      </label>

      <CostChart
        points={points}
        rows={rows}
        seqCost={cost.seq.cost}
        indexCost={cost.index?.cost ?? null}
        selectivity={plan.input.selectivity}
        crossover={plan.crossover}
      />

      <table className="w-full text-sm">
        <caption className="t-label pb-1 text-left">Pages read, and what they cost</caption>
        <thead>
          <tr className="rule-b text-muted">
            <th scope="col" className="py-0.5 text-left font-normal">
              Plan
            </th>
            <th scope="col" className="py-0.5 text-right font-normal">
              Pages
            </th>
            <th scope="col" className="py-0.5 text-right font-normal">
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="rule-b">
            <th scope="row" className="py-0.5 text-left font-normal">
              Seq Scan on orders
              <span className="text-muted"> ({ROWS_PER_PAGE} rows a page, read in order)</span>
            </th>
            <td className="t-figure py-0.5 text-right">{figure(cost.seq.pages)}</td>
            <td className="t-figure py-0.5 text-right">{figure(cost.seq.cost)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-0.5 text-left font-normal">
              {covering ? 'Index Only Scan' : 'Index Scan'}
              <span className="text-muted">
                {cost.index === null
                  ? ' (the index cannot serve this predicate)'
                  : ` (${cost.index.height} to descend, ${cost.index.leafPages} leaf, ${cost.index.heapFetches} heap, each a random read)`}
              </span>
            </th>
            <td className="t-figure py-0.5 text-right">
              {cost.index === null ? '—' : figure(cost.index.pages)}
            </td>
            <td className="t-figure py-0.5 text-right">
              {cost.index === null ? '—' : figure(cost.index.cost)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="rule-t flex flex-col gap-1 pt-2" data-testid="verdict">
        <p className="flex flex-wrap items-baseline gap-1">
          <span className="t-label">Plan</span>
          <span className="t-figure font-medium" data-testid="plan-chosen">
            {plan.verdict.chosen}
          </span>
        </p>
        {plan.verdict.rejected === null ? null : (
          <p className="flex flex-wrap items-baseline gap-1">
            <span className="t-label">Rejected</span>
            <span className="t-figure text-muted line-through">{plan.verdict.rejected}</span>
          </p>
        )}
        <p className="text-muted prose-measure text-sm">
          {`${figure(cost.matchingRows)} of ${figure(rows)} rows match, ${share(plan.input.selectivity)}. ${plan.verdict.reason}`}
        </p>
      </div>
    </section>
  );
}
