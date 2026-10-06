'use client';

import { Check, ChevronDown, Minus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useId, useState, type ReactNode } from 'react';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { formatMinutes } from '@/core/insight';
import { cleanPathName, MAX_NAME } from '@/core/planner/name';
import { coverage, toggleGroup, type Coverage } from '@/core/profile';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { openScoutPlanner } from '@/features/tutor/planner/planner-store';
import { dockTutorTrigger } from '@/features/tutor/tutor-store';
import { cn } from '@/lib/cn';
import {
  allLessonIds,
  chapterMeta,
  partLessonIds,
  partMeta,
  preview,
  sameChoice,
  summary,
  totals,
  totalsLine,
} from './builder';
import { CHOSEN_PATH, chosenPathIds } from './current';
import { isOwnPathId, newOwnPathId, restage, type CourseTree } from './custom';
import { usePathParam } from './usePathParam';

type Part = CourseTree['parts'][number];
type Chapter = Part['chapters'][number];
type Toggle = (ids: readonly string[]) => void;

/**
 * A row you tick: the whole label is the target, the drawn box says all, some or none, and a
 * native checkbox underneath (indeterminate when some) carries keyboard and screen reader.
 */
function TickRow({
  state,
  label,
  onToggle,
  children,
}: {
  state: Coverage;
  label: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <label className="group/tick flex min-w-0 flex-1 cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={state === 'all'}
        ref={(el) => {
          if (el) el.indeterminate = state === 'some';
        }}
        onChange={onToggle}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'rounded-inner transition-press peer-focus-visible:outline-accent inline-flex size-3 shrink-0 items-center justify-center border group-active/tick:scale-98 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          state === 'none'
            ? 'border-border-strong bg-surface group-hover/tick:border-fg'
            : 'border-fg bg-fg text-bg',
        )}
      >
        {state === 'all' ? <Check size={16} strokeWidth={2} /> : null}
        {state === 'some' ? <Minus size={16} strokeWidth={2} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
    </label>
  );
}

/**
 * What a closed level holds: its first few names and how many more, two lines at most.
 * Titles carry commas of their own, so names are split by a dot and the line says what
 * they are.
 */
function Preview({ kind, names }: { kind: string; names: readonly string[] }) {
  // Lesson titles run long; two of them and the count still fit two lines on a phone.
  const glimpse = preview(names, kind === 'Lessons' ? 2 : 3);
  return (
    <span className="text-muted line-clamp-2 text-sm">
      <span className="font-medium">{kind}: </span>
      {glimpse.names.map((name, i) => (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          {i > 0 ? <span className="sr-only">, </span> : null}
          <InlineCode text={name} />
        </Fragment>
      ))}
      {glimpse.more > 0 ? (
        <>
          {' '}
          <span className="t-figure whitespace-nowrap">+ {glimpse.more} more</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * A level that is ticked whole or opened to choose inside it. Closed, it previews what it
 * holds, so a first look shows that there is more beneath; open, the rows replace the preview.
 */
function Level({
  title,
  strong,
  kind,
  names,
  meta,
  ids,
  chosen,
  onToggle,
  openLabel,
  children,
}: {
  title: string;
  strong: boolean;
  kind: string;
  names: readonly string[];
  meta: string;
  ids: readonly string[];
  chosen: ReadonlySet<string>;
  onToggle: Toggle;
  openLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const state = coverage(ids, chosen);
  return (
    <>
      <TickRow state={state} label={`Choose all of ${title}`} onToggle={() => onToggle(ids)}>
        {/* Title left, its size at the right edge; below md the size sits under it. */}
        <span className="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-x-2">
          <span className={strong ? 'font-semibold' : 'font-medium'}>{title}</span>
          <span
            className={cn(
              't-figure text-sm',
              state === 'some' ? 'text-fg font-medium' : 'text-muted',
            )}
          >
            {meta}
          </span>
        </span>
        {open ? null : <Preview kind={kind} names={names} />}
      </TickRow>
      {/* The button's text lines up with the row's text: 40 px in, less its own padding. */}
      <div className="pt-0.5 pl-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'rounded-control transition-press hover:bg-raised hover:text-fg inline-flex h-5 items-center gap-0.5 px-1 text-sm font-medium active:scale-98',
            open ? 'text-fg' : 'text-muted',
          )}
        >
          {openLabel}
          <span className="sr-only"> in {title}</span>
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn('transition-transform duration-150 ease-out', open && 'rotate-180')}
          />
        </button>
      </div>
      {open ? (
        <ul id={listId} className="border-border mt-1 ml-1.5 flex flex-col border-l pl-2">
          {children}
        </ul>
      ) : null}
    </>
  );
}

function ChapterRow({
  chapter,
  chosen,
  onToggle,
}: {
  chapter: Chapter;
  chosen: ReadonlySet<string>;
  onToggle: Toggle;
}) {
  return (
    <li className="py-1">
      <Level
        title={chapter.title}
        strong={false}
        kind="Lessons"
        names={chapter.lessons.map((l) => l.title)}
        meta={chapterMeta(chapter, chosen)}
        ids={chapter.lessons.map((l) => l.id)}
        chosen={chosen}
        onToggle={onToggle}
        openLabel="Choose individual lessons"
      >
        {chapter.lessons.map((lesson) => {
          const on = chosen.has(lesson.id);
          return (
            <li key={lesson.id} className="flex items-start gap-2 py-1">
              <TickRow
                state={on ? 'all' : 'none'}
                label={`Choose ${lesson.title}`}
                onToggle={() => onToggle([lesson.id])}
              >
                <span className="text-sm">
                  <InlineCode text={lesson.title} />
                </span>
                {lesson.objective ? (
                  <span className="text-muted prose-measure hidden text-sm md:block">
                    <InlineCode text={lesson.objective} />
                  </span>
                ) : null}
              </TickRow>
              <span className="t-figure text-muted shrink-0 text-sm">{lesson.minutes} min</span>
            </li>
          );
        })}
      </Level>
    </li>
  );
}

function PartRow({
  part,
  chosen,
  onToggle,
}: {
  part: Part;
  chosen: ReadonlySet<string>;
  onToggle: Toggle;
}) {
  return (
    <li className="rule-t py-2 first:border-t-0">
      <Level
        title={part.title}
        strong
        kind="Chapters"
        names={part.chapters.map((c) => c.title)}
        meta={partMeta(part, chosen)}
        ids={partLessonIds(part)}
        chosen={chosen}
        onToggle={onToggle}
        openLabel="Choose individual chapters"
      >
        {part.chapters.map((chapter) => (
          <ChapterRow key={chapter.id} chapter={chapter} chosen={chosen} onToggle={onToggle} />
        ))}
      </Level>
    </li>
  );
}

/** The right-hand panel on desktop: what the path holds so far, and Save. */
function YourPath({
  tree,
  chosen,
  line,
  dirty,
  save,
}: {
  tree: CourseTree;
  chosen: ReadonlySet<string>;
  line: string;
  dirty: boolean;
  save: ReactNode;
}) {
  const parts = summary(tree, chosen);
  const sum = totals(tree, chosen);
  return (
    <section
      aria-labelledby="your-path"
      className="rounded-panel border-border bg-surface flex flex-col gap-3 border p-3"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="your-path" className="t-label">
          Your path
        </h2>
        <p aria-live="polite" className="flex flex-col">
          {sum.lessons === 0 ? (
            <span className="text-lg font-semibold">{line}</span>
          ) : (
            <>
              <span className="t-figure text-lg font-semibold">
                {sum.lessons} {sum.lessons === 1 ? 'lesson' : 'lessons'}
              </span>
              <span className="t-figure text-muted text-sm">
                about {formatMinutes(sum.minutes)}
              </span>
            </>
          )}
        </p>
      </div>
      {parts.length === 0 ? (
        <p className="text-muted text-sm">
          A part brings all its chapters. Open a part to take single chapters, and a chapter to take
          single lessons.
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Chosen chapters"
          className="rounded-inner -mx-1 flex max-h-50 flex-col gap-2 overflow-y-auto px-1"
        >
          {parts.map((part) => (
            <div key={part.id} className="flex flex-col gap-0.5">
              <h3 className="t-label">{part.title}</h3>
              <ul className="flex flex-col">
                {part.chapters.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2 py-0.5 text-sm">
                    <span className="min-w-0 flex-1">{c.title}</span>
                    <span className="t-figure text-muted shrink-0">
                      {c.chosen === c.total ? `All ${c.total}` : `${c.chosen} of ${c.total}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="rule-t flex flex-col gap-1 pt-2">
        {save}
        {dirty ? <p className="text-muted text-sm">Not saved yet</p> : null}
      </div>
    </section>
  );
}

/**
 * Build your own path from the course. It opens on the seven parts, each previewing its
 * chapters; a part can be chosen whole, or opened to choose chapters, and a chapter opened
 * to choose lessons. The choice is saved as one custom_path_set, and Learn then shows it
 * like any other path. With `?path=<id>` it edits that own path and keeps its name and its
 * planned stages; without, it makes a new one.
 */
export function PathBuilder({ tree }: { tree: CourseTree }) {
  const { status, state } = useProgress();
  const store = useStore();
  const router = useRouter();
  const [edited, setEdited] = useState<Set<string> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [named, setNamed] = useState<string | undefined>(undefined);
  const asked = usePathParam();
  const existing =
    status === 'ready' && asked && isOwnPathId(asked) ? state.ownPaths.get(asked) : undefined;
  const saved = new Set(existing?.lessonIds ?? []);
  const chosen = edited ?? saved;
  const hasPath = existing !== undefined;
  const name = named ?? existing?.name ?? 'My path';
  const nameId = useId();
  // The save bar owns the bottom edge, so Scout opens from the header instead of the corner.
  useEffect(() => dockTutorTrigger(), []);

  const sum = totals(tree, chosen);
  const line = totalsLine(sum.lessons, sum.minutes);
  const everything = allLessonIds(tree);
  const dirty =
    (edited !== undefined && !sameChoice(edited, saved)) ||
    (named !== undefined && named.trim() !== (existing?.name ?? '') && sum.lessons > 0);
  const removing = sum.lessons === 0 && hasPath;

  const toggle: Toggle = (ids) => setEdited(toggleGroup(chosen, ids));

  async function save() {
    setSaving(true);
    const pathId = existing?.id ?? newOwnPathId();
    const stages = restage(existing?.stages, sum.lessonIds);
    await store.record('custom_path_set', {
      pathId,
      name: cleanPathName(name),
      lessonIds: sum.lessonIds,
      ...(stages ? { stages } : {}),
      ...(existing?.summary ? { summary: existing.summary } : {}),
      ...(existing?.pace ? { pace: existing.pace } : {}),
      origin: existing?.origin ?? 'builder',
    });
    const others = chosenPathIds(state.settings[CHOSEN_PATH]).filter((id) => id !== pathId);
    const value = sum.lessons > 0 ? [pathId, ...others] : others;
    await store.record('setting_changed', { key: CHOSEN_PATH, value: value.join(',') });
    router.push(sum.lessons > 0 ? `/paths?path=${pathId}` : '/paths');
  }

  const saveButton = (wide: boolean) => (
    <Button
      variant="primary"
      onClick={() => void save()}
      loading={saving}
      disabled={!dirty || (sum.lessons === 0 && !hasPath)}
      className={cn(wide && 'w-full')}
    >
      {removing ? 'Remove this path' : 'Save path'}
    </Button>
  );

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href="/paths"
            aria-label="Leave without saving"
            title="Leave without saving"
            className="text-muted hover:text-fg hover:bg-raised rounded-control transition-press -ml-1 inline-flex size-5 shrink-0 items-center justify-center active:scale-98"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <p className="t-label flex-1">Paths</p>
          <Button
            variant="quiet"
            size="md"
            onClick={() => openScoutPlanner(existing)}
            className="text-muted hover:text-fg -mr-1"
          >
            <ScoutMark size={16} />
            {existing ? 'Plan again with Scout' : 'Plan with Scout'}
          </Button>
        </div>
      </header>

      <main
        id="content"
        className="frame flex-1 pt-4 pb-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-4"
      >
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="flex flex-col gap-2">
            <h1 className="t-title">{hasPath ? `Edit ${existing.name}` : 'Build your own path'}</h1>
            <p className="text-muted prose-measure text-lg">
              Tick a whole part, or open it to choose chapters and single lessons.
            </p>
            <div className="flex max-w-md flex-col gap-0.5">
              <label htmlFor={nameId} className="text-sm font-medium">
                Name
              </label>
              <input
                id={nameId}
                type="text"
                value={name}
                maxLength={MAX_NAME}
                onChange={(event) => setNamed(event.target.value)}
                // 16 px: iOS zooms the page when a smaller control takes focus.
                className="border-border bg-surface rounded-control hover:border-border-strong h-5 w-full min-w-0 border px-1 text-base"
              />
            </div>
            <div className="-ml-1 flex flex-wrap items-center gap-0.5">
              <Button
                variant="quiet"
                size="md"
                className="disabled:bg-transparent"
                onClick={() => setEdited(new Set(everything))}
                disabled={sum.lessons === everything.length}
              >
                Choose everything
              </Button>
              <Button
                variant="quiet"
                size="md"
                className="disabled:bg-transparent"
                onClick={() => setEdited(new Set())}
                disabled={sum.lessons === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          <ul className="rule-t rule-b flex flex-col" aria-label="The course">
            {tree.parts.map((part) => (
              <PartRow key={part.id} part={part} chosen={chosen} onToggle={toggle} />
            ))}
          </ul>
        </div>

        <aside className="mt-6 hidden lg:sticky lg:top-12 lg:col-span-4 lg:mt-0 lg:block">
          <YourPath tree={tree} chosen={chosen} line={line} dirty={dirty} save={saveButton(true)} />
        </aside>
      </main>

      {/* On desktop the panel carries Save; the bar is for screens without it. */}
      <div className="lg:hidden">
        <ActionBar className="justify-between gap-2">
          <p className="t-figure text-muted min-w-0 text-sm" aria-live="polite">
            {line}
          </p>
          {saveButton(false)}
        </ActionBar>
      </div>
    </div>
  );
}
