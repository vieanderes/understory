'use client';

import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Code,
  Copy,
  Flag,
  Gauge,
  ListChecks,
  MessageSquare,
  PenLine,
  Play,
  Route,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, use, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  GUIDE_KIND_LABEL,
  type CompiledTaskGuide,
  type GuideStepKind,
  type TaskLanguage,
} from '@/core/online-test';
import { cn } from '@/lib/cn';
import { useServices, type OnlineTestServices } from './services';

const KIND_ICON: Record<GuideStepKind, LucideIcon> = {
  read: BookOpen,
  explain: MessageSquare,
  'edge-cases': Search,
  plan: Route,
  'ask-ai': Bot,
  'ai-writes': Bot,
  write: PenLine,
  run: Play,
  test: ListChecks,
  optimise: Gauge,
  review: ClipboardCheck,
  submit: Flag,
};

interface GuidePanelProps {
  taskId: string;
  language: TaskLanguage;
  step: number;
  onStep: (index: number) => void;
  /** Puts a prompt in the assistant's box and shows the assistant. */
  onPrompt: (text: string) => void;
  /** Replaces the solution in the current language, after the candidate confirms. */
  onUseCode: (code: string) => void;
  /** Adds lines to test-input.txt. */
  onAddInput: (lines: readonly string[]) => void;
}

const guideCache = new WeakMap<
  OnlineTestServices,
  Map<string, Promise<CompiledTaskGuide | null>>
>();

function guidePromise(services: OnlineTestServices, id: string): Promise<CompiledTaskGuide | null> {
  let cache = guideCache.get(services);
  if (!cache) {
    cache = new Map();
    guideCache.set(services, cache);
  }
  let hit = cache.get(id);
  if (!hit) {
    hit = services.loadGuide(id).catch(() => null);
    cache.set(id, hit);
  }
  return hit;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true))}
      onBlur={() => setCopied(false)}
      aria-label={label}
      title={label}
      className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-4 shrink-0 items-center justify-center"
    >
      {copied ? (
        <Check aria-hidden size={16} strokeWidth={2} />
      ) : (
        <Copy aria-hidden size={16} strokeWidth={2} />
      )}
    </button>
  );
}

function Guide({
  promise,
  ...props
}: GuidePanelProps & { promise: Promise<CompiledTaskGuide | null> }) {
  const guide = use(promise);
  const [confirming, setConfirming] = useState(false);
  if (!guide) {
    return (
      <p className="text-muted p-2 text-sm">
        This task has no guide yet. The assistant is still here, and the report explains every test.
      </p>
    );
  }
  const index = Math.min(Math.max(props.step, 0), guide.steps.length - 1);
  const step = guide.steps[index]!;
  const Icon = KIND_ICON[step.kind];
  const code = step.code?.[props.language];
  const aiStep = step.kind === 'ask-ai' || step.kind === 'ai-writes';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The summary is the 48 px row of the neighbouring file tabs, less the rule below it,
          so the two lines run through as one. */}
      <details className="rule-b group text-sm">
        <summary className="text-muted hover:text-fg -mb-px flex h-6 cursor-pointer list-none items-center gap-1 px-2">
          <Route aria-hidden size={16} strokeWidth={2} />
          The path · <span className="font-mono">{guide.complexity}</span>
        </summary>
        <div
          className="ot-statement text-muted px-2 pb-1"
          dangerouslySetInnerHTML={{ __html: guide.approachHtml }}
        />
      </details>

      <ol aria-label="Steps" className="flex gap-0.5 px-2 pt-2">
        {guide.steps.map((s, i) => (
          <li key={i} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => props.onStep(i)}
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'block h-1 w-full rounded-full transition-colors',
                i === index
                  ? 'bg-accent'
                  : i < index
                    ? 'bg-fg'
                    : 'bg-border hover:bg-border-strong',
              )}
            />
          </li>
        ))}
      </ol>

      <section
        aria-labelledby="guide-step-title"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2"
      >
        <p className="t-label flex items-center gap-1">
          <Icon aria-hidden size={16} strokeWidth={2} />
          <span className="t-figure">
            Step {index + 1} of {guide.steps.length}
          </span>
          · {GUIDE_KIND_LABEL[step.kind]}
          {step.minutes ? (
            <span className="t-figure ml-auto inline-flex items-center gap-0.5">
              <Clock aria-hidden size={16} strokeWidth={2} />
              {step.minutes} min
            </span>
          ) : null}
        </p>
        <h2 id="guide-step-title" className="text-base font-semibold">
          {step.title}
        </h2>
        <div className="ot-statement text-sm" dangerouslySetInnerHTML={{ __html: step.bodyHtml }} />

        {step.prompt ? (
          <div className="flex flex-col gap-1">
            <p className="t-label">
              {aiStep && step.kind === 'ai-writes'
                ? 'Ask the assistant to write it'
                : 'Send the assistant'}
            </p>
            <div className="bg-sunken rounded-control flex items-start gap-0.5 p-1">
              <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">{step.prompt}</p>
              <CopyButton value={step.prompt} label="Copy the prompt" />
            </div>
            <div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => props.onPrompt(step.prompt ?? '')}
              >
                <Bot aria-hidden size={16} strokeWidth={2} />
                Put in the assistant
              </Button>
            </div>
          </div>
        ) : null}

        {code ? (
          <div className="flex flex-col gap-1">
            <p className="t-label flex items-center gap-0.5">
              <Code aria-hidden size={16} strokeWidth={2} />
              {step.codeMode === 'full'
                ? 'Your solution should now read'
                : 'The piece that matters'}
            </p>
            <div className="bg-sunken rounded-control flex items-start gap-0.5 p-1">
              <pre
                tabIndex={0}
                aria-label="Guide code"
                className="min-w-0 flex-1 overflow-x-auto font-mono text-sm"
              >
                {code}
              </pre>
              <CopyButton value={code} label="Copy the code" />
            </div>
            {step.codeMode === 'full' ? (
              confirming ? (
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <span className="text-muted">Replace your current code with this?</span>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      props.onUseCode(code);
                      setConfirming(false);
                    }}
                  >
                    Replace
                  </Button>
                  <Button variant="quiet" size="md" onClick={() => setConfirming(false)}>
                    Keep mine
                  </Button>
                </div>
              ) : (
                <div>
                  <Button variant="quiet" size="md" onClick={() => setConfirming(true)}>
                    Use this code
                  </Button>
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {step.input ? (
          <div className="flex flex-col gap-1">
            <p className="t-label">Add to test-input.txt</p>
            <pre className="bg-sunken rounded-control p-1 font-mono text-sm">
              {step.input.join('\n')}
            </pre>
            <div>
              <Button
                variant="secondary"
                size="md"
                onClick={() => props.onAddInput(step.input ?? [])}
              >
                Add these cases
              </Button>
            </div>
          </div>
        ) : null}

        {step.expect ? (
          <p className="border-border rounded-control border p-1 text-sm">
            <span className="font-medium">You should see: </span>
            {step.expect}
          </p>
        ) : null}
      </section>

      <div className="rule-t flex items-center gap-1 p-2">
        <Button
          variant="quiet"
          size="md"
          disabled={index === 0}
          onClick={() => props.onStep(index - 1)}
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={2} />
          Back
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="ml-auto"
          disabled={index === guide.steps.length - 1}
          onClick={() => props.onStep(index + 1)}
        >
          Next step
          <ChevronRight aria-hidden size={16} strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Guided mode's coach: one step at a time along the path a strong candidate takes, with
 * what to do, why, and the exact prompt, code or test cases where a step has them.
 */
export function GuidePanel(props: GuidePanelProps) {
  const services = useServices();
  return (
    <Suspense fallback={<p className="text-muted p-2 text-sm">Loading the guide...</p>}>
      <Guide {...props} promise={guidePromise(services, props.taskId)} />
    </Suspense>
  );
}
