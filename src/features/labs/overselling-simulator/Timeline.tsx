import type { Actor, Outcome } from '@/core/labs/overselling-simulator';
import { cn } from '@/lib/cn';
import type { ShownFrame } from './frames';

interface TimelineProps {
  frames: readonly ShownFrame[];
  /** The frame on show. Ticks after it have not happened yet and are not drawn. */
  index: number;
}

const OUTCOME: Record<Outcome, string> = {
  bought: 'bought',
  'sold-out': 'sold out',
  error: 'error',
  refunded: 'refunded',
  swept: 'swept',
  'nothing-to-sweep': 'nothing to sweep',
};

const ROLE: Record<Actor['program'], string> = {
  reserve: 'reserve',
  confirm: 'payment',
  sweep: 'expiry sweep',
  'reserve-then-confirm': 'reserve, then pay',
};

const CELL = 'rounded-inner px-1 py-0.5 text-left align-middle font-mono text-sm whitespace-nowrap';

/**
 * One actor per row, one tick per column: the shape of an interleaving. A race is a gap
 * between two cells of one row with somebody else's cell inside it, so the gap has to be
 * visible. The grid scrolls sideways inside itself, never taking the page with it.
 */
export function Timeline({ frames, index }: TimelineProps) {
  const current = frames[index] as ShownFrame;
  const ticks = frames.slice(1, index + 1);

  return (
    <section aria-label="Timeline" className="flex min-w-0 flex-col gap-1">
      <h2 className="t-label">Timeline</h2>
      {ticks.length === 0 ? (
        <p className="text-muted text-sm">
          Nothing has run yet. Step, or give one actor the turn by hand.
        </p>
      ) : null}
      <div
        role="region"
        aria-label="Timeline grid, one row per actor and one column per tick"
        tabIndex={0}
        className="border-border rounded-control w-full max-w-full overflow-x-auto border p-1"
      >
        <table className="w-max text-sm">
          <caption className="sr-only">
            What each actor did at each tick. One actor moves per tick.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="t-label bg-surface sticky left-0 z-10 px-1 text-left">
                Actor
              </th>
              {ticks.map((frame) => (
                <th
                  key={frame.tick}
                  scope="col"
                  data-tick={frame.tick}
                  className={cn(
                    't-label px-1 text-left',
                    frame.tick === current.tick && 'text-accent',
                  )}
                >
                  {`t${frame.tick}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.world.actors.map((actor) => (
              <tr key={actor.id} className="rule-t">
                <th
                  scope="row"
                  data-actor={actor.name}
                  className="bg-surface sticky left-0 z-10 px-1 py-0.5 text-left align-top font-normal"
                >
                  <span className="font-medium">{actor.name}</span>
                  <span className="text-muted block text-sm">{ROLE[actor.program]}</span>
                  {actor.outcome ? (
                    <span className="t-label block">{OUTCOME[actor.outcome]}</span>
                  ) : null}
                </th>
                {ticks.map((frame) => {
                  const event = frame.event;
                  const acted = event !== null && event.actor === actor.id;
                  const waited = frame.waiting.includes(actor.id);
                  const now = frame.tick === current.tick;
                  return (
                    <td
                      key={frame.tick}
                      data-tick={frame.tick}
                      data-actor={actor.name}
                      data-state={acted ? 'acted' : waited ? 'waits' : 'idle'}
                      className={cn(
                        CELL,
                        acted && now && 'bg-accent-tint font-medium',
                        waited && 'bg-sunken text-muted',
                        !acted && !waited && 'text-faint',
                      )}
                    >
                      {acted ? event.label : waited ? 'asleep' : <span aria-hidden>.</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
