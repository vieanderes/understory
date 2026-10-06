import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { GOAL_COPY, PLAN_GOALS } from '@/core/plan';

/**
 * The eight goals as a way into the plan setup, each opening it with that goal chosen.
 * Home and the paths page show it where a learner has no plan yet.
 */
export function GoalShortcuts({
  title = 'What do you want to be able to do?',
}: {
  title?: string;
}) {
  return (
    <section aria-labelledby="goals-shortcut-title" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id="goals-shortcut-title" className="t-section">
          {title}
        </h2>
        <p className="text-muted">
          Pick a goal and answer two questions. You get a plan in phases, with a step for today.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {PLAN_GOALS.map((goal) => (
          <li key={goal} className="rule-t">
            <Link
              href={`/plan?goal=${goal}`}
              className="hairline-row group flex min-h-6 items-center gap-2 py-2 transition-colors duration-150 ease-out"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{GOAL_COPY[goal].title}</span>
                <span className="text-muted block text-sm">{GOAL_COPY[goal].who}</span>
              </span>
              <ArrowRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
