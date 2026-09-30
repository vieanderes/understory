'use client';

import { ChevronRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  HOLDS_STRATEGIES,
  MAX_BUYERS,
  MAX_CAPACITY,
  MAX_QTY,
  MIN_BUYERS,
  RESERVE_STRATEGIES,
  SCENARIOS,
  STRATEGIES,
  isHoldsStrategy,
  normalise,
  run,
  scenarioById,
  type Actor,
  type ScenarioId,
  type Strategy,
} from '@/core/labs/overselling-simulator';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { NumberField } from '../parts/NumberField';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { enumerate } from './enumeration';
import { brokenAtTick, freshHand, stepHand, type ShownFrame } from './frames';
import { paramsOf, parsePreset, type Params } from './preset';
import { Sketch } from './Sketch';
import { StorePanel } from './StorePanel';
import { Timeline } from './Timeline';
import { Verdict } from './Verdict';

const TITLE = 'Overselling simulator';
const QUESTION =
  'Two buyers press Buy on the last ticket at the same moment. Which way of writing the reservation sells it once, and what does that cost?';

const MODES = [
  { value: 'run', label: 'Recorded run' },
  { value: 'hand', label: 'By hand' },
] as const;
type Mode = (typeof MODES)[number]['value'];

const LEFT_OUT = [
  'Real lock queues. Postgres wakes waiters in its own order and detects deadlock by finding a cycle, then kills one transaction. Here the queue is strictly first in, first out, and nothing deadlocks.',
  'Replication lag. A read replica answers with an older sold, so a check that reads a replica and writes to the primary is racing across machines as well as across statements.',
  'More than one database node. Sharding, failover and two-phase commit each add their own way to lose a write.',
  'The payment provider. Authorisation takes seconds, webhooks arrive twice or out of order, and a refund is not instant.',
  'Time. One statement is one tick, whatever it costs; there is no network, no planner and no clock, so a hold is overdue as a given fact.',
  'Predicate locks. SERIALIZABLE is modelled through the first-updater-wins rule, which decides every conflict on this one row, but not the SELECT count(*) then INSERT form of the same bug.',
];

const STATUS_START = 'Nothing has run yet. The store is as the buyers found it.';

export default function OversellingSimulator({ preset, embedded = false }: LabProps) {
  const initial = useMemo(() => parsePreset(preset), [preset]);
  const ids = useId();
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initial.scenario.id);
  const [strategy, setStrategy] = useState<Strategy>(initial.strategy);
  const [params, setParams] = useState<Params>(initial.params);
  const [mode, setMode] = useState<Mode>('run');

  const scenario = scenarioById(scenarioId) ?? initial.scenario;
  const config = useMemo(
    () => normalise({ strategy, ...params, seed: scenario.seed }),
    [strategy, params, scenario.seed],
  );
  const result = useMemo(() => run(config), [config]);
  const counts = useMemo(() => enumerate(config), [config]);
  const playback = usePlayback(result.frames.length);

  // The hand-driven run belongs to one set of parameters. Rather than mirroring the
  // parameters into state with an effect, it carries the key it was built for and a new
  // key gives a fresh world.
  const configKey = JSON.stringify(config);
  const fresh = useMemo(
    () => ({ key: configKey, frames: freshHand(config), index: 0 }),
    [configKey, config],
  );
  const [recorded, setRecorded] = useState(fresh);
  const hand = recorded.key === configKey ? recorded : fresh;

  const frames: readonly ShownFrame[] = mode === 'hand' ? hand.frames : result.frames;
  const index = mode === 'hand' ? hand.index : playback.index;
  const frame = frames[index] as ShownFrame;
  const info = STRATEGIES[config.strategy];
  const holds = isHoldsStrategy(config.strategy);
  const finished = frame.world.actors.every((actor) => actor.status === 'done');

  const startAgain = () => {
    playback.reset();
    setRecorded(fresh);
  };

  const chooseScenario = (id: string) => {
    const next = scenarioById(id);
    if (!next) return;
    setScenarioId(next.id);
    setStrategy(next.strategy);
    setParams(paramsOf(next));
    startAgain();
  };

  const chooseStrategy = (next: string) => {
    setStrategy(next as Strategy);
    startAgain();
  };

  const change = (patch: Partial<Params>) => {
    // From the normalised values on show, so an edit never revives a figure the engine clamped.
    const { buyers, capacity, sold, qtyEach } = config;
    setParams({ buyers, capacity, sold, qtyEach, ...patch });
    startAgain();
  };

  const give = (actorId: number) => {
    const next = stepHand(hand.frames, hand.index, actorId);
    setRecorded({ key: configKey, frames: next, index: next.length - 1 });
  };

  // A choice made before the page hydrated is kept, not written back over.
  const adoptScenario = useAdoptPreHydrationChoice(scenarioId, chooseScenario);
  const adoptStrategy = useAdoptPreHydrationChoice(config.strategy, chooseStrategy);

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      status={frame.event ? frame.event.message : STATUS_START}
      controls={
        mode === 'run' ? (
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
        ) : (
          <div role="toolbar" aria-label="Simulation controls" className="flex items-center gap-1">
            <Button
              size="md"
              onClick={() => setRecorded({ ...hand, index: Math.max(0, hand.index - 1) })}
              disabled={hand.index === 0}
            >
              Step back
            </Button>
            <Button
              size="md"
              variant="quiet"
              onClick={startAgain}
              disabled={hand.frames.length === 1}
            >
              Reset
            </Button>
            <span className="t-label t-figure pl-1">{`Step ${index + 1} of ${frames.length}`}</span>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {initial.hideSwitcher ? null : (
          <div className="grid gap-2 md:grid-cols-12 md:gap-x-4">
            <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
              <label htmlFor={`${ids}-scenario`} className="t-label">
                Scenario
              </label>
              <select
                id={`${ids}-scenario`}
                ref={adoptScenario}
                value={scenarioId}
                onChange={(event) => chooseScenario(event.target.value)}
                className="border-border bg-surface rounded-control h-5 w-full min-w-0 border px-1 text-base"
              >
                {SCENARIOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <p className="text-muted prose-measure text-sm">{scenario.story}</p>
            </div>

            <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
              <label htmlFor={`${ids}-strategy`} className="t-label">
                How reserve is written
              </label>
              <select
                id={`${ids}-strategy`}
                ref={adoptStrategy}
                value={config.strategy}
                onChange={(event) => chooseStrategy(event.target.value)}
                className="border-border bg-surface rounded-control h-5 w-full min-w-0 border px-1 text-base"
              >
                <optgroup label="One row: reserve(qty)">
                  {RESERVE_STRATEGIES.map((id) => (
                    <option key={id} value={id}>
                      {STRATEGIES[id].label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Hold, then confirm or expire">
                  {HOLDS_STRATEGIES.map((id) => (
                    <option key={id} value={id}>
                      {STRATEGIES[id].label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="grid grid-cols-2 gap-1 pt-1 sm:grid-cols-4">
                <NumberField
                  label="Buyers"
                  value={config.buyers}
                  min={MIN_BUYERS}
                  max={MAX_BUYERS}
                  disabled={holds}
                  onChange={(buyers) => change({ buyers })}
                />
                <NumberField
                  label="Capacity"
                  value={config.capacity}
                  min={config.qtyEach}
                  max={MAX_CAPACITY}
                  onChange={(capacity) => change({ capacity })}
                />
                <NumberField
                  label="Sold"
                  value={config.sold}
                  min={0}
                  max={config.capacity}
                  disabled={holds}
                  onChange={(sold) => change({ sold })}
                />
                <NumberField
                  label="Each buys"
                  value={config.qtyEach}
                  min={1}
                  max={MAX_QTY}
                  onChange={(qtyEach) => change({ qtyEach })}
                />
              </div>
              {holds ? (
                <p className="text-muted text-sm">
                  The holds variant has a fixed cast: the late payment, the sweep and a waiting
                  buyer. The held tickets are the last ones.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {index === 0 ? <p className="prose-measure font-medium">{scenario.prediction}</p> : null}

        <div className="grid gap-3 md:grid-cols-12 md:gap-x-4">
          <Sketch
            info={info}
            activeLine={frame.event ? frame.event.line : null}
            actor={frame.event ? actorName(frame.world.actors, frame.event.actor) : null}
            className="md:col-span-7"
          />
          <StorePanel world={frame.world} className="md:col-span-5" />
        </div>

        <div className="rule-t flex flex-col gap-2 pt-2">
          <Segmented<Mode>
            label="Drive"
            options={MODES}
            value={mode}
            onChange={(next) => setMode(next)}
          />
          {mode === 'hand' ? (
            <section aria-label="Whose turn" className="flex flex-col gap-1">
              <p className="text-muted text-sm">
                One actor moves per tick. Give the turn to whoever you like: the order is the only
                thing that changes.
              </p>
              <ul className="flex flex-wrap gap-1">
                {frame.world.actors.map((actor) => (
                  <li key={actor.id}>
                    <Button
                      size="md"
                      variant={actor.status === 'ready' ? 'secondary' : 'quiet'}
                      disabled={actor.status !== 'ready'}
                      onClick={() => give(actor.id)}
                    >
                      {turnLabel(actor)}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <Timeline frames={frames} index={index} />

        <Verdict
          world={frame.world}
          brokenAt={brokenAtTick(frames, index)}
          enumeration={counts}
          finished={finished}
        />

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
          <div className="flex flex-col gap-1 pb-1 text-sm">
            <p className="text-muted prose-measure">
              The rules come from the PostgreSQL 17 documentation: a plain SELECT takes no lock,
              UPDATE holds the row lock until the transaction ends, READ COMMITTED re-reads the row
              after a wait, and a serialisation failure is SQLSTATE 40001. What is left out:
            </p>
            <ul className="prose-measure list-disc pl-3">
              {LEFT_OUT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </LabFrame>
  );
}

function actorName(actors: readonly Actor[], id: number): string | null {
  return actors.find((actor) => actor.id === id)?.name ?? null;
}

/** The program counter in the words of the sketch, so the button says what it will run. */
const NEXT_STEP: Record<string, string> = {
  select: 'SELECT',
  'c-select': 'SELECT the hold',
  's-select': 'SELECT overdue holds',
  lock: 'SELECT FOR UPDATE',
  check: 'check in application code',
  'c-check': 'check the status it read',
  update: 'UPDATE',
  'c-write': 'confirm the hold',
  's-write': 'expire the hold',
  claim: 'guarded UPDATE of the hold',
  's-claim': 'guarded UPDATE of the hold',
  reserve: 'guarded UPDATE to reserve',
  rows: 'read the row count',
  settle: 'read the row count',
  's-settle': 'read the row count',
  commit: 'COMMIT',
  rollback: 'ROLLBACK',
  retry: 'start the transaction again',
};

/** What the button offers: the actor, and the step it would run next. */
function turnLabel(actor: Actor): string {
  if (actor.status === 'blocked') return `${actor.name} is asleep on the lock`;
  if (actor.status === 'done') return `${actor.name} has finished`;
  return `Advance ${actor.name}: ${NEXT_STEP[actor.pc] ?? actor.pc}`;
}
