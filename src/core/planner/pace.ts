import { daysBetween } from '@/core/plan/plan';

/*
 * How long a path takes at the learner's minutes a week, and whether it fits a deadline.
 * Its own module, so a path's page can show the pace without loading the planner.
 */
export interface PathPace {
  /** Weeks to finish at the learner's minutes a week, at least one. */
  weeks: number;
  /** With a deadline: days to go, and the minutes a week that would finish in time. */
  daysLeft?: number;
  minutesPerWeekNeeded?: number;
  fits?: boolean;
}

export function pathPace(
  minutesLeft: number,
  pace: { minutesPerWeek: number; deadline?: string },
  today: string,
): PathPace {
  const weeks = Math.max(1, Math.ceil(minutesLeft / pace.minutesPerWeek));
  if (!pace.deadline) return { weeks };
  const daysLeft = daysBetween(today, pace.deadline);
  const minutesPerWeekNeeded = Math.ceil((minutesLeft * 7) / Math.max(1, daysLeft));
  return {
    weeks,
    daysLeft,
    minutesPerWeekNeeded,
    fits: daysLeft >= 0 && minutesPerWeekNeeded <= pace.minutesPerWeek,
  };
}
