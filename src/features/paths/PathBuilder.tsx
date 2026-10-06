'use client';

import { Check, ChevronDown, Minus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionBar } from '@/components/layout/ActionBar';
import { Button } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { formatMinutes } from '@/core/insight';
import { coverage, toggleGroup, type Coverage } from '@/core/profile';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { CHOSEN_PATH } from './current';
import { CUSTOM_PATH_ID, type CourseTree } from './custom';

/** A box that says all, some or none, and a native checkbox underneath for keyboards. */
function Tick({
  state,
  label,
  onToggle,
}: {
  state: Coverage;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center">
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
          'rounded-control transition-press peer-focus-visible:outline-accent inline-flex size-3 items-center justify-center border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          state === 'none' ? 'border-border-strong bg-surface' : 'border-fg bg-fg text-bg',
        )}
      >
        {state === 'all' ? <Check size={16} strokeWidth={2} /> : null}
        {state === 'some' ? <Minus size={16} strokeWidth={2} /> : null}
      </span>
    </label>
  );
}

function Count({ ids, chosen }: { ids: readonly string[]; chosen: ReadonlySet<string> }) {
  const n = ids.filter((id) => chosen.has(id)).length;
  return (
    <span className="t-figure text-muted shrink-0 text-sm">
      {n > 0 ? `${n} of ${ids.length}` : `${ids.length}`}
      <span className="sr-only"> lessons</span>
    </span>
  );
}

/** A row that can be chosen whole and opened to choose inside it. */
function Group({
  title,
  ids,
  chosen,
  onToggle,
  level,
  children,
}: {
  title: string;
  ids: readonly string[];
  chosen: ReadonlySet<string>;
  onToggle: (ids: readonly string[]) => void;
  level: 'part' | 'chapter';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const state = coverage(ids, chosen);
  return (
    <li className={cn(level === 'part' ? 'rule-t' : 'border-border border-t first:border-t-0')}>
      <div className={cn('flex min-h-6 items-center gap-1', level === 'chapter' && 'pl-2')}>
        <Tick state={state} label={`Choose all of ${title}`} onToggle={() => onToggle(ids)} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="group hover:text-fg rounded-control flex min-h-5 min-w-0 flex-1 items-center gap-1 text-left transition-colors duration-150 ease-out"
        >
          <span
            className={cn(
              'min-w-0 flex-1',
              level === 'part' ? 'font-semibold' : 'font-medium',
              state === 'none' && level === 'chapter' && 'text-muted',
            )}
          >
            {title}
          </span>
          <Count ids={ids} chosen={chosen} />
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn(
              'text-faint shrink-0 transition-transform duration-150 ease-out',
              open && 'rotate-180',
            )}
          />
        </button>
      </div>
      {open ? <ul className={cn('pb-1', level === 'part' && 'pl-2')}>{children}</ul> : null}
    </li>
  );
}

/**
 * Build your own path from the course. It opens on the seven parts only; a part can be
 * chosen whole, or opened to choose chapters, and a chapter opened to choose lessons. The
 * choice is saved as one custom_path_set, and Learn then shows it like any other path.
 */
export function PathBuilder({ tree }: { tree: CourseTree }) {
  const { status, state } = useProgress();
  const store = useStore();
  const router = useRouter();
  const [edited, setEdited] = useState<Set<string> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const chosen = edited ?? new Set(status === 'ready' ? (state.customPath ?? []) : []);

  const lessons = tree.parts.flatMap((p) => p.chapters.flatMap((c) => c.lessons));
  const picked = lessons.filter((l) => chosen.has(l.id));
  const minutes = picked.reduce((sum, l) => sum + l.minutes, 0);

  const toggle = (ids: readonly string[]) => setEdited(toggleGroup(chosen, ids));

  async function save() {
    setSaving(true);
    await store.record('custom_path_set', { lessonIds: picked.map((l) => l.id) });
    await store.record('setting_changed', { key: CHOSEN_PATH, value: CUSTOM_PATH_ID });
    router.push('/paths');
  }

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href="/paths"
            aria-label="Leave without saving"
            title="Leave without saving"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <p className="t-label flex-1">Build your own path</p>
        </div>
      </header>

      <main id="content" className="frame flex max-w-3xl flex-1 flex-col gap-3 pt-4 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="t-section">Choose what to learn</h1>
          <p className="text-muted">
            Tick a whole part, or open it to choose chapters and single lessons.
          </p>
        </div>
        <ul className="rule-b flex flex-col">
          {tree.parts.map((part) => (
            <Group
              key={part.id}
              level="part"
              title={part.title}
              ids={part.chapters.flatMap((c) => c.lessons.map((l) => l.id))}
              chosen={chosen}
              onToggle={toggle}
            >
              {part.chapters.map((chapter) => (
                <Group
                  key={chapter.id}
                  level="chapter"
                  title={chapter.title}
                  ids={chapter.lessons.map((l) => l.id)}
                  chosen={chosen}
                  onToggle={toggle}
                >
                  {chapter.lessons.map((lesson) => {
                    const on = chosen.has(lesson.id);
                    return (
                      <li key={lesson.id} className="flex min-h-5 items-center gap-1 pl-4">
                        <Tick
                          state={on ? 'all' : 'none'}
                          label={`Choose ${lesson.title}`}
                          onToggle={() => toggle([lesson.id])}
                        />
                        <span className={cn('min-w-0 flex-1 text-sm', !on && 'text-muted')}>
                          <InlineCode text={lesson.title} />
                        </span>
                        <span className="t-figure text-faint shrink-0 text-sm">
                          {lesson.minutes} min
                        </span>
                      </li>
                    );
                  })}
                </Group>
              ))}
            </Group>
          ))}
        </ul>
      </main>

      <ActionBar className="justify-between">
        <p className="t-figure text-muted text-sm" aria-live="polite">
          {picked.length === 0
            ? 'Nothing chosen yet'
            : `${picked.length} ${picked.length === 1 ? 'lesson' : 'lessons'} · ${formatMinutes(minutes)}`}
        </p>
        <div className="flex items-center gap-1">
          {picked.length > 0 ? (
            <Button variant="quiet" onClick={() => setEdited(new Set())}>
              Clear
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void save()}
            loading={saving}
            disabled={picked.length === 0 && !state.customPath}
          >
            {picked.length === 0 && state.customPath ? 'Remove my path' : 'Save my path'}
          </Button>
        </div>
      </ActionBar>
    </div>
  );
}
