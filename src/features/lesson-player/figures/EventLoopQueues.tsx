import { buildScenario, run, type Frame } from '@/core/labs/event-loop-stepper';
import { QueueBox } from '@/features/labs/event-loop-stepper/QueueBox';

/**
 * The classic program at the moment the script has finished: a microtask and a timer
 * callback both wait, and the microtask will go first.
 */
export function EventLoopQueues() {
  const frames = run(buildScenario('classic'));
  const frame =
    frames.find(
      (f) =>
        f.stack.length === 0 && f.microtasks.length > 0 && f.tasks.length + f.timers.length > 0,
    ) ?? (frames[0] as Frame);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <QueueBox
        title="Microtask queue"
        headLabel="next"
        items={frame.microtasks.map((m) => ({ key: m.key, label: m.label, meta: m.origin }))}
        empty="empty"
      />
      <QueueBox
        title="Task queue"
        headLabel="next"
        items={[...frame.tasks, ...frame.timers].map((t) => ({
          key: t.key,
          label: t.label,
          meta: t.origin,
        }))}
        empty="empty"
      />
    </div>
  );
}
