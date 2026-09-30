'use client';

import { ChevronRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import {
  SCENARIOS,
  buildScenario,
  run,
  type Frame,
  type Phase,
  type ScenarioId,
} from '@/core/labs/event-loop-stepper';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { CodePanel } from './CodePanel';
import { QueueBox } from './QueueBox';
import { parsePreset } from './preset';

const TITLE = 'Event loop stepper';
const QUESTION = 'In what order does this code run, and why?';

export default function EventLoopStepper({ preset, embedded = false }: LabProps) {
  const initial = useMemo(() => parsePreset(preset), [preset]);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initial.scenario);
  const [value, setValue] = useState<number | undefined>(initial.value);
  const selectId = useId();

  const def = SCENARIOS.find((s) => s.id === scenarioId)!;
  const scenario = useMemo(() => buildScenario(scenarioId, value), [scenarioId, value]);
  const frames = useMemo(() => run(scenario), [scenario]);
  const playback = usePlayback(frames.length, 1200);
  const frame = frames[playback.index]!;
  const chosen =
    value !== undefined && def.param.options.includes(value) ? value : def.param.default;

  // A new program starts from its first frame, so that the prediction prompt is seen.
  const choose = (next: ScenarioId, nextValue: number | undefined) => {
    setScenarioId(next);
    setValue(nextValue);
    playback.reset();
  };

  // A scenario chosen before the page hydrated is kept, not discarded.
  const adoptScenario = useAdoptPreHydrationChoice(scenarioId, (next) =>
    choose(next as ScenarioId, undefined),
  );

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      status={frame.note}
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          {initial.hideSwitcher ? null : (
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={selectId} className="t-label">
                Scenario
              </label>
              <select
                id={selectId}
                ref={adoptScenario}
                value={scenarioId}
                onChange={(event) => choose(event.target.value as ScenarioId, undefined)}
                className="border-border bg-surface rounded-control h-5 max-w-full border px-1 text-sm font-medium"
              >
                {SCENARIOS.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {`${i + 1}. ${s.title}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Segmented
            label={`${def.param.label} (${def.param.unit})`}
            options={def.param.options.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
            value={String(chosen)}
            onChange={(next) => choose(scenarioId, Number(next))}
          />
        </div>

        <p className="prose-measure font-medium">
          {playback.index === 0 ? scenario.prompt : <span aria-hidden>{frame.note}</span>}
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <CodePanel source={scenario.source} line={frame.line} />
            <Console output={frame.output} />
          </div>
          <Machine frame={frame} />
        </div>

        <LeftOut />
      </div>
    </LabFrame>
  );
}

const PHASES: readonly { phase: Phase; label: string }[] = [
  { phase: 'task', label: 'Run one task' },
  { phase: 'microtasks', label: 'Empty the microtask queue' },
  { phase: 'render', label: 'Render if due' },
  { phase: 'idle', label: 'Wait' },
];

/** The processing model as four words in a row. Weight, not colour, says where the loop is. */
function LoopPhases({ phase }: { phase: Phase }) {
  return (
    <section aria-label="Loop phase">
      <ol className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-sm">
        {PHASES.map((p, i) => (
          <li
            key={p.phase}
            aria-current={p.phase === phase ? 'step' : undefined}
            className={p.phase === phase ? 'font-semibold' : 'text-faint'}
          >
            {`${i + 1} ${p.label}`}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Machine({ frame }: { frame: Frame }) {
  // The loop owes a paint but a task still holds the stack: the frozen Buy button.
  const overdue =
    frame.clockMs > frame.nextRenderMs &&
    (frame.pendingPaint.length > 0 || frame.rafQueue.length > 0);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <LoopPhases phase={frame.phase} />
      <dl className="rule-b grid grid-cols-2 gap-2 pb-2">
        <div>
          <dt className="t-label">Clock</dt>
          <dd className="t-figure text-lg">{frame.clockMs} ms</dd>
        </div>
        <div>
          <dt className="t-label">Next render opportunity</dt>
          <dd className="t-figure text-lg">
            {frame.phase === 'render'
              ? 'now'
              : `${frame.nextRenderMs} ms${overdue ? ', overdue' : ''}`}
          </dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <QueueBox
          title="Call stack"
          headLabel="top"
          accentHead
          items={[...frame.stack].reverse().map((label, i) => ({
            key: `${frame.stack.length - i}-${label}`,
            label,
          }))}
          empty="empty"
        />
        <QueueBox
          title="Microtask queue"
          headLabel="next"
          items={frame.microtasks.map((m) => ({ key: m.key, label: m.label, meta: m.origin }))}
          empty="empty"
        />
        <QueueBox
          title="Task queue"
          headLabel="next"
          items={frame.tasks.map((t) => ({ key: t.key, label: t.label, meta: t.origin }))}
          empty="empty"
        />
        <QueueBox
          title="Timers and network"
          headLabel="soonest"
          items={frame.timers.map((t) => ({
            key: t.key,
            label: t.label,
            meta: `due ${t.dueMs} ms`,
          }))}
          empty="nothing waits"
        />
      </div>
      <QueueBox
        title="Render: animation frame callbacks"
        headLabel="next"
        items={frame.rafQueue.map((r) => ({ key: r.key, label: r.label, meta: r.origin }))}
        empty="none"
      >
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Changed, not yet painted</dt>
            <dd className="font-mono">
              {frame.pendingPaint.length > 0 ? frame.pendingPaint.join('; ') : 'nothing'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">On screen</dt>
            <dd className="font-mono">
              {frame.painted.length > 0
                ? frame.painted.map((p) => `${p.text} (at ${p.atMs} ms)`).join('; ')
                : 'no paint yet'}
            </dd>
          </div>
        </dl>
      </QueueBox>
    </div>
  );
}

function Console({ output }: { output: readonly string[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h2 className="t-label flex justify-between gap-1">
        <span id={id}>Console</span>
        <span className="t-figure">{output.length}</span>
      </h2>
      {output.length === 0 ? (
        <p className="border-border text-faint rounded-inner flex h-4 items-center border border-dashed px-1 font-mono text-sm">
          no output yet
        </p>
      ) : (
        <ol className="border-border bg-bg rounded-control border px-1 py-1 font-mono text-sm">
          {output.map((text, i) => (
            <li key={i} className={i === output.length - 1 ? 'font-medium' : 'text-muted'}>
              {text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LeftOut() {
  return (
    <details className="group rule-t text-sm">
      <summary className="flex h-5 cursor-pointer list-none items-center gap-1 font-medium">
        <ChevronRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="transition-transform duration-150 ease-out group-open:rotate-90"
        />
        What this leaves out
      </summary>
      <ul className="text-muted prose-measure flex list-disc flex-col gap-1 pb-1 pl-3">
        <li>
          Node.js. Its loop has phases, process.nextTick runs before promise microtasks and
          setImmediate runs in the check phase. This lab models the browser loop of the HTML
          Standard only.
        </li>
        <li>
          Several task queues. A browser may take input before timers. Here one queue runs first in,
          first out.
        </li>
        <li>
          Timer clamping and throttling. Here a timer is due exactly when its delay has passed.
        </li>
        <li>
          The cost of code. Every line takes 0 ms except the blocking call, so the clock moves only
          when the program blocks or the loop waits.
        </li>
        <li>
          Real frame timing. Here a render opportunity comes every 16 ms and only when something
          changed. A real browser decides this itself, so a 0 ms timer against requestAnimationFrame
          is not guaranteed in practice.
        </li>
        <li>Rejected promises, await of a pending promise, workers and requestIdleCallback.</li>
      </ul>
    </details>
  );
}
