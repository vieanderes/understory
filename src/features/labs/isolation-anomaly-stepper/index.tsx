'use client';

import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  LEFT_OUT,
  LEVELS,
  LEVEL_LABEL,
  LEVEL_NOTE,
  SCENARIOS,
  TX_IDS,
  buildScenario,
  canRun,
  run,
  runNext,
  scenarioDef,
  stepStatus,
  verdict as verdictOf,
  type EngineState,
  type Level,
  type ScenarioDef,
  type ScenarioId,
  type TxId,
} from '@/core/labs/isolation-anomaly-stepper';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { SelectField } from '../parts/SelectField';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { parsePreset } from './preset';
import { TxColumn } from './TxColumn';
import { Verdict } from './Verdict';
import { Versions } from './Versions';

const TITLE = 'Isolation anomaly stepper';
const QUESTION =
  'Two transactions touch the same rows. What does each one see, and which isolation level stops the damage?';

const SCENARIO_OPTIONS = SCENARIOS.map((s) => ({ value: s.id, label: s.title }));
const LEVEL_OPTIONS = LEVELS.map((level) => ({ value: level, label: LEVEL_LABEL[level] }));

interface Wish {
  /** The scenario and variant the wish was made for. Another case starts from its own plan. */
  key: string;
  schedule: readonly TxId[];
}

export default function IsolationAnomalyStepper({ preset, embedded = false }: LabProps) {
  const initial = useMemo(() => parsePreset(preset), [preset]);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(initial.scenario);
  const [variant, setVariant] = useState(initial.variant);
  const [level, setLevel] = useState<Level>(initial.level);

  const built = useMemo(() => buildScenario(scenarioId, variant), [scenarioId, variant]);
  const def = scenarioDef(scenarioId) as ScenarioDef;
  const key = `${built.id}/${built.variant}`;

  // The learner's order belongs to one case. It carries the key it was made for, so a new
  // case falls back to its preset order without an effect mirroring state.
  const [wish, setWish] = useState<Wish | null>(null);
  const wanted = wish?.key === key ? wish.schedule : built.schedule;

  const result = useMemo(() => run(built.scenario, level, wanted), [built, level, wanted]);
  const playback = usePlayback(result.frames.length);
  const frame = result.frames[playback.index] as EngineState;
  const verdict = useMemo(() => verdictOf(built.scenario, frame), [built, frame]);

  const chooseScenario = (id: ScenarioId) => {
    const next = scenarioDef(id);
    if (!next) return;
    setScenarioId(next.id);
    setVariant((next.variants[0] as { id: string }).id);
    playback.reset();
  };

  const chooseVariant = (id: string) => {
    setVariant(id);
    playback.reset();
  };

  const runTx = (tx: TxId) => {
    // What has run stays, this transaction goes next, and the rest keeps its order. The
    // frame count never changes (one per statement), so stepping forward lands on it.
    setWish({ key, schedule: runNext(result.schedule, playback.index, tx) });
    playback.forward();
  };

  // A choice made before the page hydrated is kept, not written back over.
  const adoptScenario = useAdoptPreHydrationChoice(scenarioId, chooseScenario);
  const adoptVariant = useAdoptPreHydrationChoice(built.variant, chooseVariant);
  const adoptLevel = useAdoptPreHydrationChoice(level, setLevel);

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      status={stepStatus(built, frame)}
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
        <div className="grid gap-2 md:grid-cols-12 md:gap-x-4">
          {initial.hideSwitcher ? null : (
            <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
              <SelectField<ScenarioId>
                label="Scenario"
                value={scenarioId}
                options={SCENARIO_OPTIONS}
                onChange={chooseScenario}
                selectRef={adoptScenario}
              />
              {def.variants.length > 1 ? (
                <SelectField
                  label="How the write is made"
                  value={built.variant}
                  options={def.variants.map((v) => ({ value: v.id, label: v.label }))}
                  onChange={chooseVariant}
                  selectRef={adoptVariant}
                />
              ) : null}
              <p className="text-muted prose-measure text-sm">{built.story}</p>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
            <SelectField<Level>
              label="Isolation level"
              value={level}
              options={LEVEL_OPTIONS}
              onChange={setLevel}
              selectRef={adoptLevel}
            />
            <p className="text-muted prose-measure text-sm">{LEVEL_NOTE[level]}</p>
          </div>
        </div>

        {playback.index === 0 ? <p className="prose-measure font-medium">{built.prompt}</p> : null}

        <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
          {TX_IDS.map((tx) => (
            <TxColumn
              key={tx}
              built={built}
              tx={frame.txs[tx]}
              canRun={canRun(frame, tx)}
              onRunNext={runTx}
            />
          ))}
        </div>

        <Versions tables={built.scenario.tables} state={frame} className="rule-t pt-2" />

        <Verdict built={built} state={frame} verdict={verdict} className="rule-t pt-2" />

        <details className="group rule-t">
          <summary className="t-label flex min-h-5 cursor-pointer items-center gap-1">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-transform duration-150 ease-out group-open:rotate-90"
            />
            What this leaves out
          </summary>
          <div className="flex flex-col gap-1 pb-1 text-sm">
            <p className="text-muted prose-measure">
              The rules follow the PostgreSQL 17 documentation, section 13.2, and the serialisable
              checks follow Ports and Grittner (2012). Every scenario was stepped through a real
              PostgreSQL 17 server. What is left out:
            </p>
            <ul className="prose-measure list-disc pl-3">
              {LEFT_OUT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </LabFrame>
  );
}
