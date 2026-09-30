'use client';

import type { Track } from '@/core/labs/flex-grid-playground';
import { NumberField } from '../parts/NumberField';
import { Choice } from './Choice';
import { RANGE } from './preset';

type Kind = 'px' | 'fr' | 'auto' | 'minmax';

const KIND_OPTIONS = [
  { value: 'px', label: 'px' },
  { value: 'fr', label: 'fr' },
  { value: 'auto', label: 'auto' },
  { value: 'minmax', label: 'minmax()' },
] as const;

const MODE_OPTIONS = [
  { value: 'auto-fill', label: 'auto-fill' },
  { value: 'auto-fit', label: 'auto-fit' },
] as const;

const UNIT_OPTIONS = [
  { value: 'px', label: 'px' },
  { value: 'fr', label: 'fr' },
] as const;

/** A kind keeps nothing from the kind before it: each starts at a figure worth seeing. */
function ofKind(kind: Kind): Track {
  switch (kind) {
    case 'px':
      return { kind: 'px', size: 96 };
    case 'fr':
      return { kind: 'fr', fr: 1 };
    case 'auto':
      return { kind: 'auto' };
    case 'minmax':
      return { kind: 'minmax', min: 80, max: 1, maxUnit: 'fr' };
  }
}

interface TrackControlsProps {
  track: Track;
  index: number;
  onChange: (track: Track) => void;
}

const GROUP = 'border-border rounded-control grid grid-cols-2 gap-2 border p-1';

export function TrackControls({ track, index, onChange }: TrackControlsProps) {
  if (track.kind === 'repeat') {
    return (
      <fieldset className={GROUP}>
        <legend className="t-label px-0.5">repeat()</legend>
        <Choice
          label="Mode"
          value={track.mode}
          options={MODE_OPTIONS}
          onChange={(mode) => onChange({ ...track, mode })}
        />
        <NumberField
          label="Track minimum"
          unit="px"
          value={track.min}
          min={RANGE.repeatMin.min}
          max={RANGE.repeatMin.max}
          step={10}
          onChange={(min) => onChange({ ...track, min })}
        />
      </fieldset>
    );
  }

  return (
    <fieldset className={GROUP}>
      <legend className="t-label px-0.5">Column {index + 1}</legend>
      <Choice
        label="Kind"
        value={track.kind}
        options={KIND_OPTIONS}
        onChange={(kind) => onChange(ofKind(kind))}
      />
      {track.kind === 'px' ? (
        <NumberField
          label="Size"
          unit="px"
          value={track.size}
          min={RANGE.trackPx.min}
          max={RANGE.trackPx.max}
          step={8}
          onChange={(size) => onChange({ ...track, size })}
        />
      ) : null}
      {track.kind === 'fr' ? (
        <NumberField
          label="Factor"
          unit="fr"
          value={track.fr}
          min={RANGE.trackFr.min}
          max={RANGE.trackFr.max}
          step={0.5}
          onChange={(fr) => onChange({ ...track, fr })}
        />
      ) : null}
      {track.kind === 'auto' ? (
        <p className="text-muted self-end text-sm">Sized by its content.</p>
      ) : null}
      {track.kind === 'minmax' ? (
        <>
          <NumberField
            label="Minimum"
            unit="px"
            value={track.min}
            min={RANGE.trackPx.min}
            max={RANGE.trackPx.max}
            step={8}
            onChange={(min) => onChange({ ...track, min })}
          />
          <NumberField
            label="Maximum"
            unit={track.maxUnit}
            value={track.max}
            min={0}
            max={track.maxUnit === 'fr' ? RANGE.trackFr.max : RANGE.trackPx.max}
            step={track.maxUnit === 'fr' ? 0.5 : 8}
            onChange={(max) => onChange({ ...track, max })}
          />
          <Choice
            label="Maximum unit"
            value={track.maxUnit}
            options={UNIT_OPTIONS}
            onChange={(maxUnit) => onChange({ ...track, maxUnit, max: maxUnit === 'fr' ? 1 : 160 })}
          />
        </>
      ) : null}
    </fieldset>
  );
}
