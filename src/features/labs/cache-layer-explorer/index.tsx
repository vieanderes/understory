'use client';

import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  LEFT_OUT,
  PROFILE_NAMES,
  SCENARIOS,
  STORE_NAME,
  buildScenario,
  eventAt,
  lifeNote,
  run,
  stepStatus,
  storeRows,
  type ProfileName,
  type Scenario,
  type ScenarioDef,
  type World,
} from '@/core/labs/cache-layer-explorer';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { SelectField } from '../parts/SelectField';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { parsePreset } from './preset';
import { Stores } from './Stores';
import { Timeline } from './Timeline';

const TITLE = 'Cache-layer explorer';
const QUESTION =
  'Where is this page served from, and what does each revalidation call actually reach?';

const LIFE_OPTIONS = PROFILE_NAMES.map((name) => ({ value: name, label: `cacheLife('${name}')` }));

export default function CacheLayerExplorer({ preset, embedded = false }: LabProps) {
  const initial = useMemo(() => parsePreset(preset), [preset]);
  // A lesson's own case is offered alongside the shipped ones, and selected first.
  const cases = useMemo(
    () => (initial.custom === null ? SCENARIOS : [initial.custom, ...SCENARIOS]),
    [initial.custom],
  );
  const [scenarioId, setScenarioId] = useState(initial.scenario);
  const [variant, setVariant] = useState(initial.variant);

  const def = useMemo(
    () => cases.find((one) => one.id === scenarioId) ?? (cases[0] as ScenarioDef),
    [cases, scenarioId],
  );
  const built = useMemo(
    () => (def.id === initial.custom?.id ? fromDef(def, variant) : buildScenario(def.id, variant)),
    [def, initial.custom, variant],
  );

  // The lifetime belongs to one case: another case starts from its own profile, with no
  // effect writing state back.
  const [life, setLife] = useState<{ id: string; value: ProfileName } | null>(null);
  const profile = life?.id === def.id ? life.value : built.scenario.cache.life;
  const scenario: Scenario = useMemo(
    () =>
      profile === built.scenario.cache.life
        ? built.scenario
        : { ...built.scenario, cache: { ...built.scenario.cache, life: profile } },
    [built, profile],
  );

  const result = useMemo(() => run(scenario), [scenario]);
  const playback = usePlayback(result.frames.length);
  const frame = result.frames[playback.index] as World;
  const rows = useMemo(() => {
    const all = storeRows(scenario, frame);
    return initial.stores.length === 0
      ? all
      : all.filter((row) => initial.stores.includes(row.store));
  }, [scenario, frame, initial.stores]);

  const chooseScenario = (id: string) => {
    const next = cases.find((one) => one.id === id);
    if (next === undefined) return;
    setScenarioId(next.id);
    setVariant(next.variants[0]?.id ?? 'default');
    playback.reset();
  };

  const chooseVariant = (id: string) => {
    setVariant(id);
    playback.reset();
  };

  const chooseLife = (value: ProfileName) => {
    setLife({ id: def.id, value });
    playback.reset();
  };

  // A choice made before the page hydrated is kept, not written back over.
  const adoptScenario = useAdoptPreHydrationChoice(scenarioId, chooseScenario);
  const adoptVariant = useAdoptPreHydrationChoice(built.variant, chooseVariant);
  const adoptLife = useAdoptPreHydrationChoice(profile, chooseLife);

  const served = frame.served;
  const event = eventAt(scenario, playback.index);

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
      status={stepStatus(frame)}
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
          <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
            <SelectField
              label="Scenario"
              value={def.id}
              options={cases.map((one) => ({ value: one.id, label: one.title }))}
              onChange={chooseScenario}
              selectRef={adoptScenario}
            />
            {def.variants.length > 1 ? (
              <SelectField
                label={def.variantLabel}
                value={built.variant}
                options={def.variants.map((one) => ({ value: one.id, label: one.label }))}
                onChange={chooseVariant}
                selectRef={adoptVariant}
              />
            ) : null}
            <p className="text-muted prose-measure text-sm">{built.story}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1 md:col-span-6">
            <SelectField<ProfileName>
              label="Lifetime"
              value={profile}
              options={LIFE_OPTIONS}
              onChange={chooseLife}
              selectRef={adoptLife}
            />
            <p className="text-muted prose-measure text-sm">{lifeNote(scenario)}</p>
          </div>
        </div>

        {playback.index === 0 ? (
          <p className="prose-measure font-medium">{built.prompt}</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5" data-testid="answer">
            <p className="t-label">{event === undefined ? 'Step' : 'This step'}</p>
            <p className="prose-measure font-medium">{frame.note}</p>
            {served === null ? null : (
              <p className="t-figure text-sm">
                {served.source === 'rendered'
                  ? 'Rendered at request time'
                  : `Answered by the ${STORE_NAME[served.source].toLowerCase()}`}
                {` · v${served.value}`}
                {served.waited ? ' · the request waited' : ''}
                {served.refreshed ? ' · a refresh ran behind it' : ''}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-12 md:gap-x-4">
          <Timeline scenario={scenario} index={playback.index} className="md:col-span-4" />
          <Stores rows={rows} className="md:col-span-8" />
        </div>

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
              The rules follow the Next.js 16 documentation: Caching with Cache Components, the
              cacheLife, cacheTag, updateTag, revalidateTag and refresh references, and the Client
              Cache entry in the glossary. What is left out:
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

/** A lesson's case has one variant, so building it is just reading it. */
function fromDef(def: ScenarioDef, variant: string) {
  return {
    id: def.id,
    variant: def.variants.find((one) => one.id === variant)?.id ?? (def.variants[0]?.id as string),
    scenario: def as Scenario,
    story: def.story,
    prompt: def.prompt,
  };
}
