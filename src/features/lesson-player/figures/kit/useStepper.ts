'use client';

import { useEffect, useState } from 'react';

/** How long a step stays on screen while playing: long enough to read its sentence. */
export const PLAY_INTERVAL_MS = 2400;

export interface Stepper {
  index: number;
  count: number;
  atStart: boolean;
  atEnd: boolean;
  playing: boolean;
  next(): void;
  previous(): void;
  go(index: number): void;
  /** Plays from here to the last step once, or from the start when already at the end. */
  play(): void;
  pause(): void;
}

/** Clamps a step index into the figure's range. */
export function clampStep(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/**
 * Where a stepped figure is. Stepping by hand stops playback, so a learner who reaches
 * for a button is never fighting the timer.
 */
export function useStepper(count: number): Stepper {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const atEnd = index >= count - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = clampStep(index + 1, count);
      setIndex(next);
      if (next >= count - 1) setPlaying(false);
    }, PLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, count]);

  return {
    index,
    count,
    atStart: index === 0,
    atEnd,
    playing,
    next: () => {
      setPlaying(false);
      setIndex((i) => clampStep(i + 1, count));
    },
    previous: () => {
      setPlaying(false);
      setIndex((i) => clampStep(i - 1, count));
    },
    go: (to) => {
      setPlaying(false);
      setIndex(clampStep(to, count));
    },
    play: () => {
      if (count < 2) return;
      if (atEnd) setIndex(0);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
  };
}
