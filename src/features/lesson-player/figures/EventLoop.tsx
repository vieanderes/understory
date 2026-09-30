import { buildScenario, run, type Frame } from '@/core/labs/event-loop-stepper';
import { cn } from '@/lib/cn';
import { Label, Marker, Queue, Stack } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'Call stack', body: 'What runs now. Nothing else starts until it is empty.' },
  {
    n: 2,
    title: 'The loop',
    body: 'Takes one task, then runs every waiting microtask, then the next task.',
  },
  {
    n: 3,
    title: 'Microtask queue',
    body: 'Promise callbacks, and the rest of an async function after await.',
  },
  { n: 4, title: 'Task queue', body: 'The script, timers, events. One per turn of the loop.' },
  { n: 5, title: 'Console', body: 'What has been logged, in order.' },
];

/*
 * The figure is the lab's own run of the classic program, so it can never disagree with
 * the stepper that follows it in the lesson. Only the frames that change something the
 * learner should notice are kept, each with the part it is about.
 */
const KEPT: readonly { frame: number; focus: number[] }[] = [
  { frame: 2, focus: [1, 5] },
  { frame: 3, focus: [4] },
  { frame: 4, focus: [3] },
  { frame: 6, focus: [1, 2] },
  { frame: 8, focus: [3, 5] },
  { frame: 9, focus: [2, 4] },
  { frame: 11, focus: [4, 5] },
  { frame: 13, focus: [5] },
];

const FRAMES = run(buildScenario('classic'));
const MOMENTS: (FigureStep & { frame: Frame })[] = KEPT.map(({ frame, focus }) => {
  const f = FRAMES[frame]!;
  return { text: f.note, focus, frame: f };
});

const W = 320;
const H = 440;

const RING = { cx: 240, cy: 88, r: 44 };

// Where the loop's pointer rests in each phase, in degrees clockwise from the top.
const STOP: Record<Frame['phase'], number> = { task: 0, render: 90, microtasks: 180, idle: 270 };

// The pointer only ever turns forward, the way the loop does, so each angle is the next
// stop clockwise from the one before.
const ANGLES = MOMENTS.reduce<number[]>((angles, m) => {
  const previous = angles.at(-1) ?? 0;
  let next = previous - (previous % 360) + STOP[m.frame.phase];
  if (next < previous) next += 360;
  return [...angles, next];
}, []);

function draw(step: number, focus: ReadonlySet<number>) {
  const f = MOMENTS[step]!.frame;
  const angle = ANGLES[step]!;
  const output = f.output;
  return (
    <>
      <Stack
        x={16}
        bottom={136}
        w={144}
        capacity={2}
        label="call stack"
        items={f.stack.map((label, i) => ({ key: `${label}-${i}`, label }))}
      />
      {f.stack.length === 0 ? (
        <Label x={88} y={120} phase="future">
          empty
        </Label>
      ) : null}

      {/* The loop: a ring with the task stop at the top and the microtask stop below. */}
      <circle
        cx={RING.cx}
        cy={RING.cy}
        r={RING.r}
        strokeWidth={focus.has(2) ? 2 : 1}
        className={cn('fill-none', focus.has(2) ? 'stroke-fg' : 'stroke-muted')}
      />
      <Label
        x={RING.cx}
        y={RING.cy - RING.r - 20}
        phase={f.phase === 'task' ? 'now' : 'past'}
        weight={f.phase === 'task' ? 'medium' : 'normal'}
      >
        task
      </Label>
      <Label
        x={RING.cx}
        y={RING.cy + RING.r + 20}
        phase={f.phase === 'microtasks' ? 'now' : 'past'}
        weight={f.phase === 'microtasks' ? 'medium' : 'normal'}
      >
        microtasks
      </Label>
      <Label x={RING.cx} y={RING.cy} phase="past" className="t-label">
        loop
      </Label>
      <g
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: `${RING.cx}px ${RING.cy}px`,
        }}
        className="transition-transform duration-250 ease-out"
      >
        <circle
          cx={RING.cx}
          cy={RING.cy - RING.r}
          r={6}
          className={f.phase === 'idle' ? 'fill-faint' : 'fill-fg'}
        />
      </g>

      <Queue
        x={20}
        y={208}
        slotW={136}
        slots={2}
        label="microtask queue"
        items={f.microtasks.map((m, i) => ({
          key: m.key,
          label: m.label,
          phase: i === 0 && focus.has(3) ? 'now' : 'past',
        }))}
      />
      <Queue
        x={20}
        y={284}
        slotW={136}
        slots={2}
        label="task queue"
        items={[...f.tasks, ...f.timers].map((t, i) => ({
          key: t.key,
          label: t.label,
          phase: i === 0 && focus.has(4) ? 'now' : 'past',
        }))}
      />

      <Label x={16} y={356} anchor="start" phase="past" className="t-label">
        console
      </Label>
      {[0, 1, 2, 3].map((i) => (
        <Label
          key={i}
          x={16}
          y={376 + i * 18}
          anchor="start"
          phase={
            i < output.length
              ? i === output.length - 1 && focus.has(5)
                ? 'now'
                : 'past'
              : 'hidden'
          }
        >
          {output[i] ?? ''}
        </Label>
      ))}

      <Marker x={168} y={120} n={1} on={focus.has(1)} />
      <Marker x={RING.cx + RING.r} y={RING.cy} n={2} on={focus.has(2)} />
      <Marker x={304} y={224} n={3} on={focus.has(3)} />
      <Marker x={304} y={300} n={4} on={focus.has(4)} />
      <Marker x={304} y={356} n={5} on={focus.has(5)} />
    </>
  );
}

/** The event loop running the classic program: the stack, both queues and the console. */
export function EventLoop() {
  return (
    <SteppedFigure
      title="The event loop: the call stack, the microtask queue and the task queue as a short program runs"
      width={W}
      height={H}
      keyItems={KEY}
      steps={MOMENTS}
      draw={draw}
    />
  );
}
