'use client';

import { CircleAlert, CircleCheck, CircleX, LoaderCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { OutputLine, RunTranscript } from '@/core/online-test';
import { cn } from '@/lib/cn';

interface TestOutputProps {
  transcript: RunTranscript | null;
  running: boolean;
  /** What the sandbox is loading before the run starts, for example "Python". */
  loading?: string;
  onRun: () => void;
  disabled?: boolean;
  large?: boolean;
}

const STATUS = {
  passed: { Icon: CircleCheck, tone: 'text-success', label: 'All example tests passed' },
  warning: { Icon: CircleAlert, tone: 'text-warning', label: 'Examples passed, with warnings' },
  failed: { Icon: CircleX, tone: 'text-danger', label: 'Detected some errors' },
} as const;

function Line({ line }: { line: OutputLine }) {
  return (
    <p
      className={cn(
        'break-words whitespace-pre-wrap',
        line.tone === 'error' && 'text-danger',
        line.tone === 'muted' && 'text-muted',
        line.tone === 'emphasis' && 'italic',
      )}
    >
      {line.label ? <span className="text-fg">{line.label.padEnd(16, ' ')}</span> : null}
      {line.text}
    </p>
  );
}

/**
 * The platform's Test Output: a status icon by the heading, Run code on the right, and a
 * monospace transcript with a rule down the left of each case, red for a failed one.
 */
export function TestOutput({
  transcript,
  running,
  loading,
  onRun,
  disabled,
  large,
}: TestOutputProps) {
  const status = transcript && !running ? STATUS[transcript.status] : null;
  return (
    <section aria-labelledby="output-title" className="bg-surface flex h-full min-h-0 flex-col">
      <div className="rule-b flex h-6 shrink-0 items-center gap-1 px-2">
        <h2 id="output-title" className="shrink-0 text-sm font-semibold whitespace-nowrap">
          Test Output
        </h2>
        {status ? (
          <status.Icon
            aria-label={status.label}
            role="img"
            size={16}
            strokeWidth={2}
            className={status.tone}
          />
        ) : null}
        <Button
          variant="secondary"
          size="md"
          onClick={onRun}
          loading={running}
          disabled={disabled}
          title="Run code (F9)"
          className="ml-auto"
        >
          {running ? null : <Play aria-hidden size={16} strokeWidth={2} />}
          Run code
        </Button>
      </div>
      <div
        aria-live="polite"
        aria-busy={running}
        className={cn(
          'min-h-0 flex-1 overflow-auto p-2 font-mono',
          large ? 'text-base' : 'text-sm',
        )}
      >
        {running ? (
          <p className="text-muted flex items-center gap-1">
            <LoaderCircle aria-hidden size={16} strokeWidth={2} className="animate-spin" />
            {loading ? `Loading ${loading}...` : 'Running solution...'}
          </p>
        ) : transcript ? (
          <div className="flex flex-col gap-2">
            {transcript.header.length > 0 ? (
              <div>
                {transcript.header.map((line, i) => (
                  <Line key={i} line={line} />
                ))}
              </div>
            ) : null}
            {transcript.blocks.map((block, i) => (
              <div
                key={i}
                data-status={block.status}
                className={cn(
                  'border-l-2 pl-1',
                  block.status === 'error' ? 'border-danger' : 'border-fg',
                )}
              >
                {block.lines.map((line, j) => (
                  <Line key={j} line={line} />
                ))}
              </div>
            ))}
            <div>
              {transcript.footer.map((line, i) => (
                <Line key={i} line={line} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted font-sans">Run your code to see the example tests here.</p>
        )}
      </div>
    </section>
  );
}
