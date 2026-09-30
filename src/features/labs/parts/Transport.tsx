'use client';

import { Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TransportProps {
  canBack: boolean;
  canForward: boolean;
  playing: boolean;
  onBack: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onReset: () => void;
  /** For example "Step 4 of 17". */
  position: string;
}

/** Step back, step, play or pause, reset. Stepping is the default: play is a convenience. */
export function Transport({
  canBack,
  canForward,
  playing,
  onBack,
  onForward,
  onPlayPause,
  onReset,
  position,
}: TransportProps) {
  return (
    <div
      role="toolbar"
      aria-label="Simulation controls"
      className="flex flex-wrap items-center gap-1"
    >
      <Button
        size="md"
        onClick={onBack}
        disabled={!canBack}
        aria-label="Step back"
        title="Step back"
      >
        <StepBack aria-hidden size={16} strokeWidth={2} />
      </Button>
      <Button size="md" variant="primary" onClick={onForward} disabled={!canForward}>
        <StepForward aria-hidden size={16} strokeWidth={2} />
        Step
      </Button>
      <Button size="md" onClick={onPlayPause} disabled={!canForward && !playing}>
        {playing ? (
          <Pause aria-hidden size={16} strokeWidth={2} />
        ) : (
          <Play aria-hidden size={16} strokeWidth={2} />
        )}
        {playing ? 'Pause' : 'Play'}
      </Button>
      <Button size="md" variant="quiet" onClick={onReset}>
        <RotateCcw aria-hidden size={16} strokeWidth={2} />
        Reset
      </Button>
      <span className="t-label t-figure pl-1">{position}</span>
    </div>
  );
}
