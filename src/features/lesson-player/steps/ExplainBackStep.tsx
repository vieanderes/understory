'use client';

import { Mic, MicOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledExplainBackStep } from '@/core/content/compiled';
import { explainBackCue, pushBackQuestion } from '@/core/content/explain-back';
import {
  appendSpeech,
  dictationAnnouncement,
  dictationStatusLine,
} from '@/core/dictation/dictation';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { askTutor, useTutorAvailable } from '@/features/tutor/tutor-store';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { InlineMd } from '../parts/InlineMd';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';
import { useDictation, useSpeechSupported } from '../useDictation';

/** Long enough to make three points, short enough to stay one thought. */
const TARGET = { min: 30, max: 80 } as const;

const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * explain-back: say it in your own words, then compare with a model answer and mark the
 * points you made. Self-explanation is where understanding is built (Chi et al. 1994);
 * grading against a rubric keeps the self-assessment honest. Only the count of points made
 * is reported. The text stays on the device unless the learner asks Scout to push back on
 * it: that click, and only that, sends it to the Claude they connected Scout to.
 *
 * It can be spoken as well as typed (useDictation): explaining out loud is the interview
 * and the stand-up, and a phone keyboard is slow for a paragraph.
 */
export function ExplainBackStep({
  step,
  phase,
  onSubmissionChange,
}: StepProps<CompiledExplainBackStep>) {
  const [text, setText] = useState('');
  const [compared, setCompared] = useState(false);
  const [made, setMade] = useState<readonly boolean[]>(() => step.rubric.map(() => false));
  const countId = useId();
  const speech = useSpeechSupported();
  const dictation = useDictation((spoken) => setText((current) => appendSpeech(current, spoken)));
  const listening = dictation.state.listening;
  const scout = useTutorAvailable(usePathname());

  const checked = phase === 'checked';
  const words = wordsIn(text);
  const hits = made.filter(Boolean).length;

  function report(next: readonly boolean[]) {
    // The rubric always has three points (schema), which is what the 0..3 type says.
    const rubricHits = Math.min(3, next.filter(Boolean).length) as 0 | 1 | 2 | 3;
    onSubmissionChange({ type: 'explain-back', rubricHits });
  }

  function compare() {
    dictation.stop();
    setCompared(true);
    report(made);
  }

  function pushBack() {
    askTutor(
      pushBackQuestion({
        prompt: step.prompt.md,
        cue: explainBackCue(step),
        explanation: text,
        rubric: step.rubric,
        modelAnswer: step.modelAnswer.md,
      }),
    );
  }

  const statusLine = dictationStatusLine(dictation.state.error);

  function toggle(index: number) {
    const next = made.map((value, i) => (i === index ? !value : value));
    setMade(next);
    report(next);
  }

  return (
    <StepLayout>
      <div className="flex flex-col gap-0.5">
        <p className="t-label">{explainBackCue(step)}</p>
        <RichText value={step.prompt} className="t-section" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex min-h-4 items-center justify-between gap-2">
          <label htmlFor={`${countId}-text`} className="t-label">
            Your explanation
          </label>
          {speech && !compared ? (
            <button
              type="button"
              aria-pressed={listening}
              onClick={listening ? dictation.stop : dictation.start}
              className={cn(
                'rounded-control -my-0.5 inline-flex h-4 items-center gap-1 border px-1 text-sm font-medium',
                'transition-press active:scale-98',
                listening
                  ? 'border-border-strong bg-raised text-fg'
                  : 'text-muted hover:text-fg hover:bg-raised border-transparent',
                FOCUS,
              )}
            >
              {listening ? (
                <MicOff aria-hidden size={16} strokeWidth={2} />
              ) : (
                <Mic aria-hidden size={16} strokeWidth={2} />
              )}
              Say it out loud
            </button>
          ) : null}
        </div>
        <textarea
          id={`${countId}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Once the model answer is out, the explanation is what gets marked, as written.
          readOnly={compared}
          rows={6}
          aria-describedby={`${countId} ${countId}-aim`}
          // 16 px: iOS zooms the page when a smaller field takes focus.
          className={cn(
            'rounded-control bg-surface w-full resize-y border p-2 text-base',
            'transition-colors duration-150 ease-out',
            compared ? 'border-border text-muted' : 'border-border hover:border-faint',
          )}
        />
        {listening ? (
          <p className="flex min-w-0 items-start gap-1 text-sm">
            <span className="text-fg inline-flex shrink-0 items-center gap-0.5 font-medium">
              <span aria-hidden className="dictation-live bg-danger size-1 rounded-full" />
              <span className="t-figure">{clock(dictation.remaining)}</span>
            </span>
            <span className="text-muted min-w-0 text-pretty">
              {dictation.state.interim || 'Listening…'}
            </span>
          </p>
        ) : null}
        <p className="text-muted flex justify-between gap-2 text-sm">
          <span id={countId} className="t-figure">
            {words} {words === 1 ? 'word' : 'words'}
          </span>
          <span id={`${countId}-aim`}>
            Aim for {TARGET.min} to {TARGET.max}
          </span>
        </p>
        {listening && dictation.showHint ? (
          <p className="text-muted text-sm text-pretty">
            Your browser turns speech into text, and may use its maker&rsquo;s servers to do it.
            Understory stores no audio.
          </p>
        ) : null}
        {statusLine && !listening && !compared ? (
          <p className="text-muted text-sm">{statusLine}</p>
        ) : null}
        {speech ? (
          // Start, the last ten seconds and the stop: not a number a second.
          <p aria-live="polite" className="sr-only">
            {dictationAnnouncement(dictation.state)}
          </p>
        ) : null}
      </div>

      {compared ? (
        <div className="step-in flex flex-col gap-3">
          <div className="rule-t pt-2">
            <p className="t-label pb-1">Model answer</p>
            <RichText value={step.modelAnswer} />
          </div>
          <fieldset disabled={checked} className="min-w-0">
            <legend className="t-label pb-1">My explanation made this point</legend>
            <div className="flex flex-col gap-1">
              {step.rubric.map((point, i) => (
                <label
                  key={i}
                  className={cn(
                    'rounded-control flex min-h-6 items-center gap-2 border px-2 py-1 transition-colors duration-150 ease-out',
                    'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                    !checked && 'cursor-pointer',
                    made[i] ? 'border-accent bg-accent-tint' : 'border-border hover:bg-raised',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={made[i] ?? false}
                    onChange={() => toggle(i)}
                    className="accent-accent size-2 shrink-0"
                  />
                  <InlineMd text={point} className="min-w-0 flex-1" />
                </label>
              ))}
            </div>
          </fieldset>
          {scout ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Button variant="secondary" size="md" onClick={pushBack}>
                <ScoutMark size={16} />
                Ask Scout to push back
              </Button>
              <p className="text-muted text-sm">Sends your explanation to Scout.</p>
            </div>
          ) : null}
          {checked ? (
            <p role="status" className="rule-t pt-2 font-medium">
              {hits} of {step.rubric.length} points made
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={compare} disabled={words === 0}>
            Compare
          </Button>
        </div>
      )}
    </StepLayout>
  );
}
