'use client';

import type { Compartment } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { Check, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import type { TypeDiagnostic } from '@/core/ports/type-checker';
import { withTypeCheck } from '@/core/typecheck/verdict';
import { cn } from '@/lib/cn';
import type { TypecheckHandle } from '../typecheck-types';
import { typecheckExtension } from './extension';
import { acquireChecker } from './shared-checker';
import { createTypecheckStore, type TypecheckSnapshot } from './store';

export interface TypecheckLayerProps {
  viewRef: RefObject<EditorView | null>;
  /** The editor's slot for the checker's extension. */
  compartment: Compartment;
  tests: string;
  handleRef?: RefObject<TypecheckHandle | null>;
}

function summary({ status, diagnostics }: TypecheckSnapshot): string {
  if (status === 'loading') return 'Loading the type checker';
  if (status === 'unavailable')
    return 'Types are not checked: the checker did not load. The tests still run.';
  if (diagnostics.length === 0) return 'No type errors';
  return diagnostics.length === 1 ? '1 type error' : `${diagnostics.length} type errors`;
}

/**
 * The type checker for one editor, and the list of what it found. Loaded in a chunk of
 * its own, only for a type-checked step, so neither the lesson nor a JavaScript step
 * carries the compiler's client.
 *
 * The list is the accessible form of the underlines: each error with its line, a button
 * that puts the caret on it, and a status line that a screen reader announces when the
 * count changes. On a phone it is also the one place to read every message at once.
 */
export default function TypecheckLayer({
  viewRef,
  compartment,
  tests,
  handleRef,
}: TypecheckLayerProps) {
  const [store] = useState(createTypecheckStore);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const lease = acquireChecker();
    view.dispatch({
      effects: compartment.reconfigure(
        typecheckExtension({ checker: lease.checker, tests, store }),
      ),
    });
    if (handleRef) {
      handleRef.current = {
        begin(code) {
          const outcome = lease.checker.check({ code, tests });
          return async (result) => withTypeCheck(result, await outcome);
        },
      };
    }
    return () => {
      if (handleRef) handleRef.current = null;
      lease.release();
    };
  }, [viewRef, compartment, tests, handleRef, store]);

  function reveal(d: TypeDiagnostic) {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: d.from }, scrollIntoView: true });
    view.focus();
  }

  const { status, diagnostics } = snapshot;
  const clean = status === 'ready' && diagnostics.length === 0;
  const failing = status === 'ready' && diagnostics.length > 0;
  const Icon = clean ? Check : X;

  return (
    <section
      aria-label="Type check"
      data-testid="type-check"
      data-status={status}
      data-count={diagnostics.length}
      className="flex flex-col gap-0.5"
    >
      <p
        role="status"
        className={cn(
          'flex min-h-3 items-center gap-1 text-sm',
          clean ? 'text-success' : failing ? 'text-danger font-medium' : 'text-muted font-mono',
        )}
      >
        {clean || failing ? (
          <Icon aria-hidden size={16} strokeWidth={2} className="shrink-0" />
        ) : null}
        {summary(snapshot)}
      </p>
      {status === 'ready' && diagnostics.length > 0 ? (
        <ul className="flex flex-col" data-testid="type-errors">
          {diagnostics.map((d, index) => (
            <li
              // The same error can appear twice at one place; order is stable within a check.
              key={`${index}-${d.from}-${d.message}`}
              className="rule-t flex items-start gap-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => reveal(d)}
                className="t-figure text-fg hover:bg-raised rounded-control transition-press min-h-3 shrink-0 px-0.5 text-sm font-medium underline underline-offset-2"
              >
                {`Line ${d.line}`}
              </button>
              <p className="text-muted min-w-0 font-mono text-sm break-words whitespace-pre-wrap">
                {d.message}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
