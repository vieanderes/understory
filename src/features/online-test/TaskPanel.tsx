'use client';

import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import {
  SIGNATURE_SLOT,
  signatureLine,
  TOPIC_LABEL,
  type CompiledTask,
  type TaskLanguage,
} from '@/core/online-test';
import { cn } from '@/lib/cn';

interface TaskPanelProps {
  task: CompiledTask;
  number: number;
  language: TaskLanguage;
  collapsed: boolean;
  onToggle: () => void;
  /** Proctored tests block copying the statement and log the attempt, as the platform does. */
  onCopyBlocked?: () => void;
  large?: boolean;
}

function SignatureChip({ line }: { line: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-sunken rounded-inner inline-flex max-w-full items-start gap-1 px-1 py-0.5">
      <code className="text-syntax-keyword font-mono text-sm break-words whitespace-pre-wrap">
        {line}
      </code>
      <button
        type="button"
        aria-label="Copy the function signature"
        title="Copy"
        onClick={() => {
          void navigator.clipboard?.writeText(line.replace(/;$/, '')).then(() => setCopied(true));
        }}
        onBlur={() => setCopied(false)}
        className="text-muted hover:text-fg rounded-inner inline-flex size-3 shrink-0 items-center justify-center"
      >
        {copied ? (
          <Check aria-hidden size={16} strokeWidth={2} />
        ) : (
          <Copy aria-hidden size={16} strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

/**
 * The task statement, as the platform shows it: "Task N" with a collapse control, the text,
 * and the function signature in a chip that follows the chosen language.
 */
export function TaskPanel({
  task,
  number,
  language,
  collapsed,
  onToggle,
  onCopyBlocked,
  large,
}: TaskPanelProps) {
  const [before, after = ''] = task.statementHtml.split(SIGNATURE_SLOT);
  const Chevron = collapsed ? ChevronRight : ChevronLeft;

  if (collapsed) {
    return (
      <section
        aria-label={`Task ${number}, collapsed`}
        className="bg-surface flex h-full w-6 flex-col items-center py-1"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show the task"
          title="Show the task"
          aria-expanded={false}
          className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center"
        >
          <Chevron aria-hidden size={16} strokeWidth={2} />
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`task-title-${task.id}`}
      className="bg-surface flex h-full min-h-0 flex-col"
    >
      <div className="rule-b flex h-6 shrink-0 items-center gap-1 px-2">
        <h2
          id={`task-title-${task.id}`}
          className="shrink-0 text-sm font-semibold whitespace-nowrap"
        >
          Task <span className="t-figure">{number}</span>
        </h2>
        <span className="text-faint min-w-0 truncate text-sm">
          {task.title} · {TOPIC_LABEL[task.topic]}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Hide the task"
          title="Hide the task"
          aria-expanded
          className="text-muted hover:text-fg hover:bg-raised rounded-control ml-auto inline-flex size-4 shrink-0 items-center justify-center"
        >
          <Chevron aria-hidden size={16} strokeWidth={2} />
        </button>
      </div>
      <div
        className={cn(
          'ot-statement min-h-0 flex-1 overflow-auto px-2 py-2',
          large ? 'text-lg' : 'text-base',
        )}
        onCopy={(event) => {
          if (!onCopyBlocked) return;
          event.preventDefault();
          onCopyBlocked();
        }}
      >
        <div className="ot-statement" dangerouslySetInnerHTML={{ __html: before ?? '' }} />
        {task.statementHtml.includes(SIGNATURE_SLOT) ? (
          <SignatureChip line={signatureLine(task.signature, language)} />
        ) : null}
        <div className="ot-statement" dangerouslySetInnerHTML={{ __html: after }} />
      </div>
    </section>
  );
}
