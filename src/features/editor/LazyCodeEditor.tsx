'use client';

import { Component, lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import type { CodeEditorProps } from './CodeEditor';
import { COARSE_POINTER, useMediaQuery } from './useMediaQuery';

/*
 * CodeMirror arrives with the first code step and not before: the dynamic import below
 * is the only reference to `./CodeEditor`, so the bundler gives it a chunk of its own
 * (tests/e2e/bundle-budget.spec.ts holds that line).
 */
const CodeEditor = lazy(() => import('./CodeEditor'));

export interface LazyCodeEditorProps extends CodeEditorProps {
  /**
   * The starting code, highlighted at build time. It holds the editor's box while the
   * chunk loads. It has the same geometry, so nothing moves when the editor takes over.
   */
  placeholderHtml?: string;
}

/** Border, padding and lines of `.code-view pre`, which the editor theme repeats. */
function boxHeight(lines: number): string {
  return `calc(${lines} * 1.5rem + 2rem + 2px)`;
}

function lineCount(text: string): number {
  return text.split('\n').length;
}

/** The editor's header row, with the space its Full screen key will take on a touch screen. */
function Header({ header, keySpace }: { header: ReactNode; keySpace: boolean }) {
  if (header === undefined && !keySpace) return null;
  return (
    <div className="flex min-h-5 items-center gap-1">
      <div className="min-w-0 flex-1">{header}</div>
      {keySpace ? <div className="-mr-1 size-5 shrink-0" /> : null}
    </div>
  );
}

function Placeholder({
  value,
  placeholderHtml,
  minLines = 8,
  readOnly,
  header,
}: LazyCodeEditorProps) {
  const coarse = useMediaQuery(COARSE_POINTER);
  // A restored draft may be longer than the starter that is shown meanwhile.
  const style: CSSProperties = { minHeight: boxHeight(Math.max(minLines, lineCount(value))) };
  return (
    <div className="flex flex-col gap-1" aria-busy="true">
      <Header header={header} keySpace={coarse && !readOnly} />
      {placeholderHtml ? (
        <div
          className="code-view wrap editor-placeholder"
          // Source files end with a line break, and the editor shows the empty last line
          // that the highlighter drops. The placeholder leaves room for it.
          data-trailing-line={value.endsWith('\n')}
          style={style}
          dangerouslySetInnerHTML={{ __html: placeholderHtml }}
        />
      ) : (
        <div className="code-view wrap editor-placeholder" style={style}>
          <pre>
            <code>{value}</code>
          </pre>
        </div>
      )}
      {/* The symbol bar's row, kept free so the editor does not push the page down. */}
      {coarse && !readOnly ? <div className="h-7" /> : null}
    </div>
  );
}

/**
 * What the learner gets when the editor chunk cannot be fetched (offline, a deploy in
 * progress): a plain field. No highlighting and no indent help, but the step can still
 * be written, run and checked. A broken download must never block learning.
 */
function PlainEditor({
  value,
  onChange,
  readOnly,
  ariaLabel,
  minLines = 8,
  header,
}: CodeEditorProps) {
  return (
    <div className="flex flex-col gap-1">
      <Header header={header} keySpace={false} />
      <textarea
        aria-label={ariaLabel}
        data-testid="plain-editor"
        className="bg-surface border-border rounded-panel text-fg w-full resize-y border p-2 font-mono text-sm pointer-coarse:text-base"
        rows={Math.max(minLines, lineCount(value))}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <p className="text-muted font-mono text-sm">
        The editor did not load. This plain field works the same.
      </p>
    </div>
  );
}

class ChunkBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function LazyCodeEditor({ placeholderHtml, ...editor }: LazyCodeEditorProps) {
  return (
    <ChunkBoundary fallback={<PlainEditor {...editor} />}>
      <Suspense fallback={<Placeholder placeholderHtml={placeholderHtml} {...editor} />}>
        <CodeEditor {...editor} />
      </Suspense>
    </ChunkBoundary>
  );
}
