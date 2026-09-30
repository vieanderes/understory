'use client';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CompiledFillBlankStep } from '@/core/content/compiled';
import { mulberry32, shuffle } from '@/core/util';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { Feedback } from '../parts/Feedback';
import { RichText } from '../parts/RichText';
import { StepLayout } from '../parts/StepLayout';
import { VerdictMark } from '../parts/VerdictMark';

const NO_HOSTS: ReadonlyMap<string, HTMLElement> = new Map();

function perBlankOf(detail: unknown): Readonly<Record<string, boolean>> {
  if (typeof detail !== 'object' || detail === null || !('perBlank' in detail)) return {};
  return (detail as { perBlank: Record<string, boolean> }).perBlank;
}

const SLOT =
  'rounded-control inline-flex h-5 min-w-8 items-center justify-center gap-0.5 border px-1 align-middle font-mono text-sm text-fg';

/**
 * fill-blank: complete the code from a bank of tokens. No typing, so it plays the same
 * on a phone as at a desk, and a typo is never mistaken for a misconception.
 *
 * The highlighted template is static HTML with an empty `<span data-blank>` per blank.
 * Each slot is portalled into its span. CodeView stamps attributes in a DOM pass, which
 * suits a line that only changes colour; a slot is a control with a label, a pressed
 * state, an icon and a verdict, and rebuilding that by hand would repeat what React
 * already does. React writes `innerHTML` only when the string changes, and the player
 * remounts the step for a new attempt, so the hosts live as long as the component.
 */
export function FillBlankStep({
  step,
  phase,
  grade,
  reveal,
  seed,
  onSubmissionChange,
}: StepProps<CompiledFillBlankStep>) {
  /** Blank key to index in `step.bank`. An index, because a bank may hold a token twice. */
  const [filled, setFilled] = useState<Readonly<Record<string, number>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [hosts, setHosts] = useState(NO_HOSTS);

  // The hosts exist only once the HTML is in the document, so they are collected when
  // the container attaches, not during render.
  const attach = useCallback((root: HTMLDivElement | null) => {
    if (!root) return;
    const found = new Map<string, HTMLElement>();
    for (const host of root.querySelectorAll<HTMLElement>('[data-blank]'))
      found.set(host.dataset.blank ?? '', host);
    setHosts(found);
  }, []);

  const order = useMemo(
    () =>
      shuffle(
        step.bank.map((_, i) => i),
        mulberry32(seed),
      ),
    [step.bank, seed],
  );

  const checked = phase === 'checked';
  const perBlank = perBlankOf(grade?.detail);
  const used = new Set(Object.values(filled));

  function commit(next: Readonly<Record<string, number>>) {
    setFilled(next);
    const complete = step.blanks.every((blank) => next[blank.key] !== undefined);
    onSubmissionChange(
      complete
        ? {
            type: 'fill-blank',
            values: Object.fromEntries(
              step.blanks.map((blank) => [blank.key, step.bank[next[blank.key] ?? -1] ?? '']),
            ),
          }
        : null,
    );
  }

  function place(bankIndex: number) {
    if (used.has(bankIndex)) return;
    const target = selected ?? step.blanks.find((blank) => filled[blank.key] === undefined)?.key;
    if (target === undefined) return;
    commit({ ...filled, [target]: bankIndex });
    setSelected(null);
  }

  function pressSlot(key: string) {
    if (filled[key] === undefined) {
      setSelected(selected === key ? null : key);
      return;
    }
    // An emptied slot stays selected: the next token belongs where the last one was wrong.
    commit(Object.fromEntries(Object.entries(filled).filter(([k]) => k !== key)));
    setSelected(key);
  }

  const rightCount = step.blanks.filter((blank) => perBlank[blank.key] === true).length;

  return (
    <StepLayout>
      <RichText value={step.prompt} className="t-section" />
      <div
        ref={attach}
        role="group"
        aria-label="Code to complete"
        className="code-view wrap slotted"
        dangerouslySetInnerHTML={{ __html: step.templateHtml }}
      />
      {step.blanks.map((blank, i) => {
        const host = hosts.get(blank.key);
        if (!host) return null;
        const bankIndex = filled[blank.key];
        const token = bankIndex === undefined ? undefined : step.bank[bankIndex];
        if (checked) {
          const ok = perBlank[blank.key] === true;
          return createPortal(
            <span className={cn(SLOT, ok ? 'border-success' : 'border-danger')}>
              <span className="sr-only">Blank {i + 1}: </span>
              {!ok && reveal ? (
                <>
                  <s className="text-muted">{token}</s>
                  <VerdictMark right={false} />
                  <span className="sr-only">Right token: </span>
                  <span>{blank.answer}</span>
                </>
              ) : (
                <>
                  <span>{token}</span>
                  <VerdictMark right={ok} />
                </>
              )}
            </span>,
            host,
            blank.key,
          );
        }
        const isSelected = selected === blank.key;
        return createPortal(
          <button
            type="button"
            onClick={() => pressSlot(blank.key)}
            aria-label={
              token === undefined ? `Blank ${i + 1}, empty` : `Remove ${token} from blank ${i + 1}`
            }
            aria-pressed={token === undefined ? isSelected : undefined}
            className={cn(
              SLOT,
              'transition-press cursor-pointer active:scale-98',
              isSelected
                ? 'border-accent bg-accent-tint'
                : token === undefined
                  ? 'border-faint hover:bg-raised border-dashed'
                  : 'border-border bg-bg hover:bg-raised',
            )}
          >
            {token}
          </button>,
          host,
          blank.key,
        );
      })}
      {checked ? null : (
        <div role="group" aria-label="Tokens" className="flex flex-wrap gap-1">
          {order.map((bankIndex) => {
            const isUsed = used.has(bankIndex);
            return (
              <button
                key={bankIndex}
                type="button"
                onClick={() => place(bankIndex)}
                // Not `disabled`: a used token keeps its place and keeps the focus that
                // was on it, so a keyboard user is not thrown back to the page top.
                aria-disabled={isUsed}
                className={cn(
                  'rounded-control border-border transition-press inline-flex h-5 min-w-5 items-center justify-center border px-2 font-mono text-sm',
                  isUsed
                    ? 'cursor-default opacity-40'
                    : 'hover:bg-raised cursor-pointer active:scale-98',
                )}
              >
                {step.bank[bankIndex]}
              </button>
            );
          })}
        </div>
      )}
      {checked && grade ? (
        <Feedback verdict={grade.correct ? 'right' : rightCount > 0 ? 'partly' : 'wrong'}>
          <p>
            {rightCount} of {step.blanks.length} blanks right.
            {grade.correct || reveal ? '' : ' The marked blanks are wrong.'}
          </p>
        </Feedback>
      ) : null}
    </StepLayout>
  );
}
