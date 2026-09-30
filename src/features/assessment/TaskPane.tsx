'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledCodeChallengeStep } from '@/core/content/compiled';
import type { RunResult } from '@/core/ports/code-runner';
import { draftKey, readDraft, writeDraft } from '@/features/editor/draft-store';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import { RichText } from '@/features/lesson-player/parts/RichText';
import { TestResults } from '@/features/lesson-player/parts/TestResults';

const LANGUAGE_NAME: Record<CompiledCodeChallengeStep['language'], string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript and React',
  python: 'Python',
};

/** As in a lesson: long enough for the examples, short enough that a loop is felt. */
export const EXAMPLE_TIMEOUT_MS = 3000;
const MIN_LINES = 16;

export function taskDraftKey(lessonId: string, stepId: string): string {
  return draftKey(`assessment:${lessonId}`, stepId);
}

/** The code a task holds right now: the draft if there is one, else the starter. */
export function taskCode(lessonId: string, step: CompiledCodeChallengeStep): string {
  return readDraft(taskDraftKey(lessonId, step.id)) ?? step.starterCode;
}

interface TaskPaneProps {
  lessonId: string;
  step: CompiledCodeChallengeStep;
  number: number;
  onCodeChange: (stepId: string, code: string) => void;
  run: (step: CompiledCodeChallengeStep, code: string) => Promise<RunResult>;
  disabled: boolean;
}

/**
 * One task of an assessment. Run checks the examples only, like the platforms' Run
 * button: the score comes from tests the learner does not see until the end.
 */
export function TaskPane({ lessonId, step, number, onCodeChange, run, disabled }: TaskPaneProps) {
  // Mounted only on the client, after the attempt has started, so the draft is readable.
  const [code, setCode] = useState(() => taskCode(lessonId, step));
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  function edit(next: string) {
    setCode(next);
    writeDraft(taskDraftKey(lessonId, step.id), next);
    onCodeChange(step.id, next);
  }

  async function runExamples() {
    if (running || disabled) return;
    setRunning(true);
    try {
      setResult(await run(step, code));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
      <div className="col-span-4 flex min-w-0 flex-col gap-2 md:col-span-5">
        <RichText value={step.prompt} />
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-1 md:col-span-7">
        <p className="t-label">Your solution · {LANGUAGE_NAME[step.language]}</p>
        <LazyCodeEditor
          value={code}
          onChange={edit}
          language={step.language}
          readOnly={disabled}
          ariaLabel={`Your code for task ${number}`}
          minLines={Math.max(MIN_LINES, step.starterCode.split('\n').length + 2)}
          placeholderHtml={step.starterHtml}
          onRun={() => void runExamples()}
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Button
            variant="secondary"
            onClick={() => void runExamples()}
            loading={running}
            disabled={disabled}
          >
            {running ? null : <Play aria-hidden size={16} strokeWidth={2} />}
            Run examples
          </Button>
          <p className="text-muted text-sm">Examples only. Hidden tests score the task.</p>
        </div>
        <TestResults result={result} running={running} timeoutMs={EXAMPLE_TIMEOUT_MS} />
      </div>
    </div>
  );
}
