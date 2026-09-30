'use client';

import { ChevronDown, ChevronLeft, ChevronRight, File, FolderOpen } from 'lucide-react';
import { useId } from 'react';
import {
  FILE_EXTENSION,
  inputHint,
  LANGUAGE_LABEL,
  LANGUAGE_VERSION,
  formatArgs,
  type CompiledTask,
  type TaskLanguage,
} from '@/core/online-test';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import { cn } from '@/lib/cn';

export type SolutionFile = 'solution' | 'input';

interface SolutionPanelProps {
  task: CompiledTask;
  number: number;
  language: TaskLanguage;
  languages: readonly TaskLanguage[];
  code: string;
  input: string;
  file: SolutionFile;
  onFile: (file: SolutionFile) => void;
  onCode: (code: string) => void;
  onInput: (text: string) => void;
  onLanguage: (language: TaskLanguage) => void;
  onRun: () => void;
  onSave: () => void;
  onPaste?: (chars: number) => void;
  vim: boolean;
  large: boolean;
  /** Visible editor rows, from the space the layout gives the editor. */
  rows: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Hides the Files tree where the column is narrow. */
  compact: boolean;
  readOnly: boolean;
}

function FileRow({
  active,
  name,
  onClick,
  controls,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
  controls: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      aria-controls={controls}
      className={cn(
        'rounded-control flex h-4 w-full items-center gap-0.5 pr-1 pl-3 text-left text-sm',
        active ? 'bg-sunken text-fg font-medium' : 'text-muted hover:bg-raised',
      )}
    >
      <File aria-hidden size={16} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{name}</span>
    </button>
  );
}

/**
 * The platform's solution panel: a Files tree with the solution and test-input.txt, editor
 * tabs, the language dropdown, the editor and the hint bar under it.
 */
export function SolutionPanel(props: SolutionPanelProps) {
  const {
    task,
    number,
    language,
    languages,
    code,
    input,
    file,
    onFile,
    onCode,
    onInput,
    onLanguage,
    onRun,
    onSave,
    onPaste,
    vim,
    large,
    rows,
    collapsed,
    onToggle,
    compact,
    readOnly,
  } = props;
  const selectId = useId();
  const editorId = useId();
  const solutionName = `solution.${FILE_EXTENSION[language]}`;
  const example = task.examples[0] ? formatArgs(task.examples[0].args) : '[1, 2, 3]';

  if (collapsed) {
    return (
      <section
        aria-label="Solution, collapsed"
        className="bg-surface flex h-full w-6 flex-col items-center py-1"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show the solution"
          title="Show the solution"
          aria-expanded={false}
          className="text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 items-center justify-center"
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={2} />
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="solution-title" className="bg-surface flex h-full min-h-0 flex-col">
      <div className="rule-b flex h-6 shrink-0 items-center gap-1 px-2">
        <h2 id="solution-title" className="shrink-0 text-sm font-semibold whitespace-nowrap">
          Solution
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Hide the solution"
          title="Hide the solution"
          aria-expanded
          className="text-muted hover:text-fg hover:bg-raised rounded-control ml-auto inline-flex size-4 items-center justify-center"
        >
          <ChevronRight aria-hidden size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {compact ? null : (
          <nav
            aria-label="Files"
            className="border-border flex w-24 shrink-0 flex-col gap-0.5 border-r p-1"
          >
            <p className="t-label px-1 pb-0.5">Files</p>
            <p className="text-fg flex h-4 items-center gap-0.5 px-1 text-sm">
              <FolderOpen aria-hidden size={16} strokeWidth={2} />
              task{number}
            </p>
            <FileRow
              active={file === 'solution'}
              name={solutionName}
              onClick={() => onFile('solution')}
              controls={editorId}
            />
            <FileRow
              active={file === 'input'}
              name="test-input.txt"
              onClick={() => onFile('input')}
              controls={editorId}
            />
          </nav>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="rule-b flex h-6 shrink-0 items-center gap-1 pr-2">
            <div
              role="tablist"
              aria-label="Open files"
              className="flex h-full min-w-0 overflow-x-auto"
            >
              {(
                [
                  ['solution', solutionName],
                  ['input', 'test-input.txt'],
                ] as const
              ).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={file === id}
                  aria-controls={editorId}
                  onClick={() => onFile(id)}
                  title={id === 'input' ? inputHint(example) : undefined}
                  className={cn(
                    'flex h-full items-center gap-0.5 border-b-2 px-2 text-sm whitespace-nowrap',
                    file === id
                      ? 'border-accent text-fg'
                      : 'text-muted hover:text-fg border-transparent',
                  )}
                >
                  <File aria-hidden size={16} strokeWidth={2} />
                  {name}
                </button>
              ))}
            </div>
            <label htmlFor={selectId} className="text-muted ml-auto hidden text-sm lg:inline">
              Language:
            </label>
            <div className="relative">
              <select
                id={selectId}
                aria-label="Language"
                value={language}
                disabled={readOnly || languages.length < 2}
                onChange={(event) => onLanguage(event.target.value as TaskLanguage)}
                className="bg-surface border-border rounded-control h-4 appearance-none border pr-3 pl-1 text-sm"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABEL[l]}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={2}
                className="text-muted pointer-events-none absolute top-0.5 right-0.5"
              />
            </div>
          </div>

          <div
            id={editorId}
            className="min-h-0 flex-1 overflow-auto"
            onPaste={(event) => {
              const text = event.clipboardData.getData('text');
              if (text) onPaste?.(text.length);
            }}
          >
            {file === 'solution' ? (
              <LazyCodeEditor
                key={`${task.id}:${language}`}
                documentKey={`${task.id}:${language}`}
                value={code}
                onChange={onCode}
                language={language}
                ariaLabel={`Solution for task ${number}, ${LANGUAGE_LABEL[language]}`}
                minLines={Math.max(8, rows)}
                onRun={onRun}
                onSave={onSave}
                assist="exam"
                vim={vim}
                fontScale={large ? 'large' : 'default'}
                readOnly={readOnly}
              />
            ) : (
              <textarea
                aria-label="test-input.txt"
                value={input}
                onChange={(event) => onInput(event.target.value)}
                readOnly={readOnly}
                spellCheck={false}
                placeholder={inputHint(example)}
                onKeyDown={(event) => {
                  if (event.key === 'F9') {
                    event.preventDefault();
                    onRun();
                  }
                }}
                className={cn(
                  'bg-surface text-fg h-full min-h-24 w-full resize-none p-2 font-mono outline-none',
                  large ? 'text-base' : 'text-sm',
                )}
              />
            )}
          </div>

          <div className="bg-raised rule-t text-muted flex h-3 shrink-0 items-center gap-2 px-2 text-sm">
            <span className="hidden truncate md:inline">
              To leave the editor use Ctrl + Shift + M
            </span>
            <span className="ml-auto truncate">Language version: {LANGUAGE_VERSION[language]}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
