'use client';

import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import {
  allKeys,
  ascendingKeys,
  height,
  KEY_LIMIT,
  MAX_KEY,
  pageCount,
  QUERIES,
  randomKeys,
  run as runProgram,
  SCENARIOS,
  scenarioById,
  scenarioTree,
  type ProgramOp,
  type Tree,
} from '@/core/labs/btree-index-explorer';
import { mulberry32 } from '@/core/util';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { NumberField } from '../parts/NumberField';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { CostPanel } from './CostPanel';
import { defaultIndexId, parsePreset, stopForRows } from './preset';
import { Select } from './Select';
import { TreeDiagram } from './TreeDiagram';

const TITLE = 'B-tree index explorer';
const QUESTION =
  'How does an index find a row, and when does the planner decide that reading the whole table is cheaper?';

/** A batch small enough to watch, large enough to force splits at more than one level. */
const BATCH = 10;

const LEFT_OUT = [
  'Deletion and page merging. Keys only arrive here. A real index also removes entries, and a page that falls below half full is merged with a sibling or borrows from one.',
  'Concurrency. Real readers and writers hold latches on a page while they touch it, and Lehman and Yao add a right-link and a high key to every level so a reader that arrives mid-split can follow the split sideways. Only the leaf chain is drawn here.',
  'Visibility maps and MVCC. Postgres keeps several versions of a row, so an index entry points at a version that this transaction may not be allowed to see. That is what forces the heap fetch an index-only scan hopes to avoid.',
  'Bitmap scans. Between the two plans here sits a third: collect the matching entries, sort them into heap order, then read each heap page once. It is why a real crossover sits higher than this one.',
  'Real planner statistics. The planner works from sampled histograms and most-common-value lists, not from the true selectivity, and it adds a CPU cost per tuple. A wrong estimate is the usual reason a real plan surprises you.',
  'Caching. The upper levels of a hot index are almost always in memory, so the descent is nearly free, while this model charges four cost units for every one of those pages.',
  'Duplicate keys, which a real index stores, and the rightmost split that Postgres biases to leave the left page nearly full under ascending inserts. Here keys are unique and every split is in the middle.',
];

export default function BtreeIndexExplorer({ preset, embedded = false }: LabProps) {
  const initial = useMemo(() => parsePreset(preset), [preset]);
  const [scenarioId, setScenarioId] = useState(initial.scenario.id);
  const [base, setBase] = useState<Tree>(() => scenarioTree(initial.scenario));
  const [ops, setOps] = useState<readonly ProgramOp[]>(initial.scenario.ops);
  const [seed, setSeed] = useState(1);
  const [key, setKey] = useState(505);
  const [from, setFrom] = useState(300);
  const [to, setTo] = useState(520);
  const [rowsStop, setRowsStop] = useState(initial.rowsStop);
  const [queryId, setQueryId] = useState(initial.queryId);
  const [indexId, setIndexId] = useState(initial.indexId);
  const [covering, setCovering] = useState(false);

  const scenario = scenarioById(scenarioId);
  const program = useMemo(() => runProgram(base, ops), [base, ops]);
  const playback = usePlayback(program.frames.length, 1100);
  const frame = program.frames[playback.index]!;
  const tree = program.tree;
  const room = KEY_LIMIT - allKeys(tree).length;

  /* The operation on screen is applied whole, and the new one starts from its first step. */
  const apply = (next: readonly ProgramOp[]) => {
    setBase(tree);
    setOps(next);
    playback.reset();
  };

  const chooseScenario = (id: string) => {
    const next = scenarioById(id);
    setScenarioId(next.id);
    setBase(scenarioTree(next));
    setOps(next.ops);
    setSeed(1);
    setRowsStop(stopForRows(next.rows));
    setQueryId(next.queryId);
    setIndexId(next.indexId);
    setCovering(false);
    playback.reset();
  };

  const chooseQuery = (id: string) => {
    setQueryId(id);
    setIndexId(defaultIndexId(QUERIES.find((q) => q.id === id)!));
  };

  const batch = (keys: readonly number[]) =>
    apply(keys.map((k) => ({ type: 'insert', key: k, summary: true }) as const));

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      status={frame.message}
      controls={
        <Transport
          canBack={playback.canBack}
          canForward={playback.canForward}
          playing={playback.playing}
          onBack={playback.back}
          onForward={playback.forward}
          onPlayPause={playback.playPause}
          onReset={playback.reset}
          position={playback.position}
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        {initial.hideSwitcher ? null : (
          <Select
            className="md:max-w-80"
            label="Scenario"
            value={scenarioId}
            onChange={chooseScenario}
            options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}

        <p className="prose-measure font-medium">
          {playback.index === 0 ? scenario.prompt : <span aria-hidden>{frame.message}</span>}
        </p>

        <section aria-label="The tree" className="flex min-w-0 flex-col gap-2">
          <dl className="grid grid-cols-3 gap-2">
            <Figure label="Height" value={String(height(frame.tree))} unit="levels" />
            <Figure
              label="Pages in tree"
              value={String(pageCount(frame.tree))}
              note={`${frame.tree.maxKeys} keys a page`}
            />
            <Figure label="Pages read" value={String(frame.pagesRead)} note="this operation" />
          </dl>

          <TreeDiagram frame={frame} />

          <div className="grid min-w-0 items-end gap-2 md:grid-cols-12 md:gap-x-4">
            <NumberField
              className="md:col-span-3"
              label="Key"
              value={key}
              onChange={setKey}
              min={1}
              max={MAX_KEY}
            />
            <div className="flex flex-wrap gap-1 md:col-span-9">
              <Button
                size="md"
                disabled={room <= 0}
                onClick={() => apply([{ type: 'insert', key }])}
              >
                Insert
              </Button>
              <Button size="md" onClick={() => apply([{ type: 'search', key }])}>
                Look up
              </Button>
              <Button
                size="md"
                disabled={room <= 0}
                onClick={() => {
                  batch(randomKeys(tree, Math.min(BATCH, room), mulberry32(seed), MAX_KEY));
                  setSeed((s) => s + 1);
                }}
              >
                Insert {BATCH} random
              </Button>
              <Button
                size="md"
                disabled={room <= 0}
                onClick={() => batch(ascendingKeys(tree, Math.min(BATCH, room), MAX_KEY))}
              >
                Insert ascending run
              </Button>
            </div>
            <NumberField
              className="md:col-span-3"
              label="Scan from"
              value={from}
              onChange={setFrom}
              min={1}
              max={MAX_KEY}
            />
            <NumberField
              className="md:col-span-3"
              label="Scan to"
              value={to}
              onChange={setTo}
              min={1}
              max={MAX_KEY}
            />
            <div className="flex flex-wrap gap-1 md:col-span-6">
              <Button size="md" onClick={() => apply([{ type: 'range', from, to }])}>
                Range scan
              </Button>
              <Button size="md" variant="quiet" onClick={() => chooseScenario(scenarioId)}>
                Rebuild tree
              </Button>
            </div>
          </div>
          <p className="text-muted text-sm">
            {room > 0
              ? `Room for ${room} more keys before the drawing stops explaining.`
              : 'The tree is full for this lab. Rebuild it to start again.'}
          </p>
        </section>

        <div className="rule-t min-w-0 pt-2">
          <CostPanel
            rowsStop={rowsStop}
            onRowsStop={setRowsStop}
            queryId={queryId}
            onQuery={chooseQuery}
            indexId={indexId}
            onIndex={setIndexId}
            covering={covering}
            onCovering={setCovering}
          />
        </div>

        <details className="group rule-t">
          <summary className="t-label flex min-h-5 cursor-pointer items-center gap-1">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-transform duration-150 ease-out group-open:rotate-90"
            />
            What this leaves out
          </summary>
          <ul className="prose-measure list-disc pb-1 pl-3 text-sm">
            {LEFT_OUT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
    </LabFrame>
  );
}
