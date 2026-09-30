'use client';

import { ChevronRight, Minus, Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  HOP_LABEL,
  SCENARIOS,
  journey,
  scenarioById,
  type CdnMode,
  type HopId,
  type HttpCacheState,
  type HttpVersion,
  type JourneyInput,
} from '@/core/labs/request-journey';
import { cn } from '@/lib/cn';
import type { LabProps } from '../contract';
import { LabFrame } from '../parts/LabFrame';
import { Transport } from '../parts/Transport';
import { usePlayback } from '../parts/usePlayback';
import { useAdoptPreHydrationChoice } from '../parts/useAdoptPreHydrationChoice';
import { RTT_MAX, RTT_MIN, RTT_STEP, startFrom } from './preset';
import { SequenceDiagram } from './SequenceDiagram';
import { Timeline } from './Timeline';

const TITLE = 'Request journey';
const QUESTION =
  'What happens between pressing Enter on a URL and seeing the page, and where does the time go?';

const HTTP_OPTIONS = [
  { value: '1.1', label: '1.1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
] as const;
const CDN_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'miss', label: 'Miss' },
  { value: 'hit', label: 'Hit' },
] as const;
const CACHE_OPTIONS = [
  { value: 'empty', label: 'Empty' },
  { value: 'stale', label: 'Stale' },
  { value: 'fresh', label: 'Fresh' },
] as const;

const LEFT_OUT = [
  'TCP slow start and congestion control: a new connection sends a few packets, then waits. A 60 kB page needs more than one flight.',
  'Packet loss and retransmission.',
  'HTTP/2 multiplexing and prioritisation. For one document, versions 1.1 and 2 cost the same here.',
  'OCSP and other certificate checks.',
  'Happy Eyeballs: racing IPv6 against IPv4.',
  'Service workers, which can answer before any of this starts.',
  'Redirects, and the scripts and images that load after first paint.',
];

const FIELD = 'border-border bg-surface rounded-control h-5 w-full border px-1 text-sm';
const TOGGLE = 'flex min-h-5 cursor-pointer items-center gap-1 text-sm';

/** Hops that can never cost anything are not worth predicting. */
const predictable = (hop: HopId) => hop !== 'url' && hop !== 'cache';

export default function RequestJourneyLab({ preset, embedded }: LabProps) {
  const [start] = useState(() => startFrom(preset));
  const [scenarioId, setScenarioId] = useState(start.scenario.id);
  const [input, setInput] = useState<JourneyInput>(start.input);
  const [prediction, setPrediction] = useState<HopId | ''>('');
  const [finishedOnce, setFinishedOnce] = useState(false);
  const [previousTotalMs, setPreviousTotalMs] = useState<number | null>(null);
  const ids = useId();

  const scenario = scenarioById(scenarioId) ?? start.scenario;
  const run = useMemo(() => journey(input), [input]);
  const playback = usePlayback(run.frames.length);
  const frame = run.frames[playback.index]!;
  const atEnd = playback.index === run.frames.length - 1;
  const revealed = finishedOnce || atEnd;

  const options = run.breakdown.filter((entry) => predictable(entry.hop));
  const predicted = options.some((entry) => entry.hop === prediction)
    ? (prediction as HopId)
    : null;
  const dominantLabel = run.dominant.map((hop) => HOP_LABEL[hop]).join(' and ');
  const dominantMs = run.breakdown.find((entry) => entry.hop === run.dominant[0])?.ms ?? 0;

  const chooseScenario = (id: string) => {
    const next = scenarioById(id);
    if (!next) return;
    setScenarioId(next.id);
    setInput(next.input);
    setPrediction('');
    setFinishedOnce(false);
    setPreviousTotalMs(null);
    playback.reset();
  };

  // A scenario or a prediction chosen before the page hydrated is kept, not discarded.
  const adoptScenario = useAdoptPreHydrationChoice(scenarioId, chooseScenario);
  const adoptPrediction = useAdoptPreHydrationChoice(prediction, (next) =>
    setPrediction(next as HopId | ''),
  );

  const change = (patch: Partial<JourneyInput>) => {
    if (atEnd) setFinishedOnce(true);
    setPreviousTotalMs(run.totalMs);
    setInput((current) => ({ ...current, ...patch }));
  };

  const setRtt = (value: number) => change({ rttMs: Math.min(RTT_MAX, Math.max(RTT_MIN, value)) });

  return (
    <LabFrame
      title={embedded ? undefined : TITLE}
      question={embedded ? undefined : QUESTION}
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
      status={<span className="sr-only">{frame.status}</span>}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-12 md:gap-x-4">
          <div className="flex flex-col gap-1 md:col-span-7">
            <label htmlFor={`${ids}-scenario`} className="t-label">
              Scenario
            </label>
            <select
              id={`${ids}-scenario`}
              ref={adoptScenario}
              className={FIELD}
              value={scenarioId}
              onChange={(event) => chooseScenario(event.target.value)}
            >
              {SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <p className="text-muted text-sm">{scenario.story}</p>
          </div>

          <div
            role="group"
            aria-labelledby={`${ids}-rtt`}
            className="flex flex-col gap-1 md:col-span-5"
          >
            <p id={`${ids}-rtt`} className="t-label">
              Round trip to the origin
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="md"
                aria-label="Decrease round trip time"
                title="Decrease round trip time"
                disabled={input.rttMs <= RTT_MIN}
                onClick={() => setRtt(input.rttMs - RTT_STEP)}
              >
                <Minus aria-hidden size={16} strokeWidth={2} />
              </Button>
              <span className="t-figure min-w-10 text-center font-medium">{input.rttMs} ms</span>
              <Button
                size="md"
                aria-label="Increase round trip time"
                title="Increase round trip time"
                disabled={input.rttMs >= RTT_MAX}
                onClick={() => setRtt(input.rttMs + RTT_STEP)}
              >
                <Plus aria-hidden size={16} strokeWidth={2} />
              </Button>
            </div>
          </div>

          <details className="group rule-t md:col-span-12">
            <summary className="t-label flex min-h-5 cursor-pointer items-center gap-1">
              <ChevronRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className="transition-transform duration-150 ease-out group-open:rotate-90"
              />
              Caches and protocol
            </summary>
            <div className="grid gap-2 pb-1 md:grid-cols-12 md:gap-x-4">
              <div className="flex flex-col md:col-span-5">
                <label className={TOGGLE}>
                  <input
                    type="checkbox"
                    className="accent-accent size-2"
                    checked={input.dnsCached}
                    onChange={(event) => change({ dnsCached: event.target.checked })}
                  />
                  DNS cached
                </label>
                <label className={TOGGLE}>
                  <input
                    type="checkbox"
                    className="accent-accent size-2"
                    checked={input.connectionReused}
                    onChange={(event) => change({ connectionReused: event.target.checked })}
                  />
                  Connection reused
                </label>
                <label className={TOGGLE}>
                  <input
                    type="checkbox"
                    className="accent-accent size-2"
                    checked={input.tlsResumed}
                    onChange={(event) => change({ tlsResumed: event.target.checked })}
                  />
                  TLS resumed with 0-RTT
                </label>
                <label className={TOGGLE}>
                  <input
                    type="checkbox"
                    className="accent-accent size-2"
                    checked={input.renderBlockingCss}
                    onChange={(event) => change({ renderBlockingCss: event.target.checked })}
                  />
                  Render-blocking stylesheet
                </label>
              </div>
              <div className="flex flex-col gap-2 md:col-span-7">
                <Segmented<HttpCacheState>
                  label="HTTP cache"
                  options={CACHE_OPTIONS}
                  value={input.httpCache ?? 'empty'}
                  onChange={(httpCache) => change({ httpCache })}
                />
                <Segmented<CdnMode>
                  label="CDN edge"
                  options={CDN_OPTIONS}
                  value={input.cdn}
                  onChange={(cdn) => change({ cdn })}
                />
                <Segmented<HttpVersion>
                  label="HTTP version"
                  options={HTTP_OPTIONS}
                  value={input.http}
                  onChange={(http) => change({ http })}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="rule-t flex flex-col gap-1 pt-2">
          <label htmlFor={`${ids}-prediction`} className="font-medium">
            {scenario.prediction}
          </label>
          <select
            id={`${ids}-prediction`}
            ref={adoptPrediction}
            className={FIELD}
            value={predicted ?? ''}
            onChange={(event) => setPrediction(event.target.value as HopId | '')}
          >
            <option value="">No prediction yet</option>
            {options.map((entry) => (
              <option key={entry.hop} value={entry.hop}>
                {entry.label}
              </option>
            ))}
          </select>
          {atEnd ? (
            <p className="text-sm" data-testid="verdict">
              {predicted ? (
                <span
                  className={cn(
                    'font-medium',
                    run.dominant.includes(predicted) ? 'text-success' : 'text-danger',
                  )}
                >
                  {run.dominant.includes(predicted) ? 'Prediction holds. ' : 'Prediction missed. '}
                </span>
              ) : null}
              {dominantLabel} cost the most: <span className="t-figure">{dominantMs} ms</span> of{' '}
              <span className="t-figure">{run.totalMs} ms</span>.
            </p>
          ) : null}
        </div>

        <div className="rule-t grid gap-3 pt-2 md:grid-cols-12 md:gap-x-4">
          <section aria-label="Current step" className="flex min-w-0 flex-col gap-1 md:col-span-5">
            <p className="t-label">
              {frame.hop === 'start' ? 'Start' : HOP_LABEL[frame.hop]}
              {frame.costMs > 0 ? <span className="t-figure"> · +{frame.costMs} ms</span> : null}
            </p>
            <h2 className="font-medium">{frame.title}</h2>
            <p className="text-muted prose-measure text-sm">{frame.status}</p>
            {frame.lines.length > 0 ? (
              <pre
                tabIndex={0}
                aria-label="Lines on the wire"
                className="border-border bg-bg rounded-control overflow-x-auto border p-1 font-mono text-sm"
              >
                {frame.lines.join('\n')}
              </pre>
            ) : null}
          </section>
          <div className="min-w-0 md:col-span-7">
            <SequenceDiagram parties={run.parties} frames={run.frames} index={playback.index} />
          </div>
        </div>

        <div className="rule-t pt-2">
          <Timeline
            run={run}
            index={playback.index}
            revealed={revealed}
            previousTotalMs={previousTotalMs}
          />
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
              Every hop costs whole round trips plus fixed work. The DNS upstream queries and the
              browser figures are nominal. Real page loads also pay for:
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
