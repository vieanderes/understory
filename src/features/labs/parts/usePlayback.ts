'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Position in a precomputed list of frames. Labs compute every frame up front from the
 * pure engine, so stepping back is free and the view is a function of one index.
 * Play advances on a timer and stops at the end. Reduced motion slows nothing down here:
 * frames change discretely, there is no animation to remove.
 */
export function usePlayback(frameCount: number, intervalMs = 900) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, frameCount - 1);
  // A new program can be shorter than the old position.
  const at = Math.min(index, last);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, last, intervalMs]);

  const forward = useCallback(() => setIndex((i) => Math.min(last, i + 1)), [last]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const playPause = useCallback(() => setPlaying((p) => (at >= last ? false : !p)), [at, last]);

  return {
    index: at,
    playing: playing && at < last,
    canBack: at > 0,
    canForward: at < last,
    forward,
    back,
    reset,
    playPause,
    position: `Step ${at + 1} of ${frameCount}`,
  };
}
