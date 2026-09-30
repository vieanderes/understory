'use client';

import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import type { ConceptView } from '@/core/insight';
import type { MasteryState } from '@/core/mastery';
import { useOverview } from '@/features/catalog/useOverview';
import { useFlip } from '@/features/motion/useFlip';
import { cn } from '@/lib/cn';
import { CELL_STYLE, STATE_LABEL, STATE_STYLE } from './states';

export interface MapModule {
  id: string;
  number: number;
  title: string;
  concepts: { id: string; title: string; summary: string }[];
}

/** A part of the course: the modules it groups, in course order. */
export interface MapPart {
  id: string;
  title: string;
  summary: string;
  modules: string[];
}

type Lens = 'all' | 'held' | 'gaps';

const LENSES = [
  { value: 'all', label: 'All' },
  { value: 'held', label: 'Started' },
  { value: 'gaps', label: 'Gaps and due' },
] as const;

const SHORT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

function dueLabel(view: ConceptView | undefined): string {
  if (!view) return '··';
  if (view.state === 'assumed') return 'Probe';
  if (!view.nextDue) return '··';
  return view.dueNow ? 'Now' : SHORT.format(new Date(view.nextDue));
}

const STARTED: ReadonlySet<MasteryState> = new Set([
  'introduced',
  'practised',
  'solid',
  'fluent',
  'gap',
]);

/** The modules no part owns: their lessons are woven into the parts (cs, clean, pro). */
const WOVEN = {
  id: 'woven',
  title: 'Woven through the course',
  summary:
    'Computer science, clean code and professional habits, met a lesson at a time inside the other parts.',
};

interface Group {
  id: string;
  number: number | null;
  title: string;
  summary: string;
  modules: MapModule[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The mastery map is a typeset index, not a node graph: part, then module, then concept
 * with its recall and due date. It opens on the parts alone, one line each with what you
 * hold, so the size of the course is a list of eight, not a wall of concepts. It is
 * rendered on the server with every concept unseen, and the learner's state is laid over
 * it once the log is read. Weight is what you hold. Memory fades, so the page does.
 */
export function MapView({ modules, parts = [] }: { modules: MapModule[]; parts?: MapPart[] }) {
  const { view } = useOverview();
  const [lens, setLens] = useState<Lens>('all');
  const partList = useRef<HTMLOListElement>(null);
  const captureParts = useFlip(partList, '[data-testid="map-part"]', lens);
  const [allOpen, setAllOpen] = useState(false);
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const byId = new Map(view?.concepts.map((c) => [c.id, c]));
  const stateOf = (id: string): MasteryState => byId.get(id)?.state ?? 'unseen';
  const reviewDue = (id: string) => stateOf(id) === 'gap' || (byId.get(id)?.dueNow ?? false);

  const visible = (id: string) => {
    if (lens === 'held') return STARTED.has(stateOf(id));
    if (lens === 'gaps') return reviewDue(id);
    return true;
  };

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const owned = new Set(parts.flatMap((p) => p.modules));
  const allGroups: Group[] = [
    ...parts.map((part, i): Group => ({
      id: part.id,
      number: i + 1,
      title: part.title,
      summary: part.summary,
      modules: part.modules.flatMap((id) => moduleById.get(id) ?? []),
    })),
    { ...WOVEN, number: null, modules: modules.filter((m) => !owned.has(m.id)) },
  ];
  const groups = allGroups
    .map((group) => ({
      ...group,
      modules: group.modules
        .map((m) => ({ ...m, concepts: m.concepts.filter((c) => visible(c.id)) }))
        .filter((m) => m.concepts.length > 0),
    }))
    .filter((group) => group.modules.length > 0);

  const startedIn = (concepts: { id: string }[]) =>
    concepts.filter((c) => STARTED.has(stateOf(c.id))).length;

  // With a filter on, everything that is left is worth seeing. Without one, a part opens
  // by itself only when something in it is started, or when it is the first of all.
  const anyStarted = modules.some((m) => startedIn(m.concepts) > 0);
  const partByDefault = (group: Group) =>
    lens !== 'all' ||
    group.modules.some((m) => startedIn(m.concepts) > 0) ||
    (!anyStarted && group.id === groups[0]?.id);
  const isOpen = (id: string, byDefault: boolean) => allOpen || byDefault !== toggled.has(id);
  const toggle = (id: string) =>
    setToggled((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openPart = (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (group && !isOpen(id, partByDefault(group))) toggle(id);
    requestAnimationFrame(() =>
      document.getElementById(`map-row-${id}`)?.scrollIntoView({ block: 'start' }),
    );
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <section aria-labelledby="atlas-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="t-label">One cell per concept</p>
          <h2 id="atlas-title" className="t-section">
            The atlas
          </h2>
        </div>
        <ul className="border-border flex flex-col border-b sm:grid sm:grid-cols-2 sm:gap-2 sm:border-b-0 lg:grid-cols-4">
          {allGroups.map((group) => {
            const concepts = group.modules.flatMap((m) => m.concepts);
            const started = startedIn(concepts);
            const toReview = concepts.filter((c) => reviewDue(c.id)).length;
            const partLabel =
              group.number === null ? (
                'Across the parts'
              ) : (
                <>
                  Part <span className="t-figure">{pad(group.number)}</span>
                </>
              );
            return (
              <li key={group.id} data-arrive="rise">
                <button
                  type="button"
                  onClick={() => openPart(group.id)}
                  className="group border-border sm:bg-surface sm:rounded-panel sm:hover:border-fg flex h-full min-h-6 w-full flex-col gap-1 border-t py-1 text-left transition-colors duration-150 ease-out active:scale-98 sm:gap-2 sm:border sm:p-2"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="t-label hidden sm:inline">{partLabel}</span>
                    <span className="group-hover:text-accent min-w-0 font-medium transition-colors duration-150 ease-out sm:hidden">
                      {group.number === null ? null : (
                        <span className="t-figure text-faint pr-1 text-sm">
                          {pad(group.number)}
                        </span>
                      )}
                      {group.title}
                    </span>
                    <span className="t-figure text-muted shrink-0 text-sm">
                      <span className="text-fg">{started}</span>/{concepts.length}
                      {toReview > 0 ? (
                        <span className="text-accent sm:hidden"> · {toReview} due</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="group-hover:text-accent hidden font-medium transition-colors duration-150 ease-out sm:block">
                    {group.title}
                  </span>
                  <span aria-hidden className="hidden flex-wrap gap-0.5 sm:flex">
                    {concepts.map((c) => (
                      <span key={c.id} className={cn('size-1', CELL_STYLE[stateOf(c.id)])} />
                    ))}
                  </span>
                  <StateBar states={concepts.map((c) => stateOf(c.id))} />
                  <span className="sr-only">
                    {started} of {concepts.length} concepts started
                  </span>
                  {toReview > 0 ? (
                    <span className="t-label text-accent hidden sm:inline">
                      {toReview} to review
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="index-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <p className="t-label">Recall and due dates</p>
            <h2 id="index-title" className="t-section">
              The index
            </h2>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <Segmented
              label="Show"
              hideLabel
              options={LENSES}
              value={lens}
              onChange={(next) => {
                captureParts();
                setLens(next);
              }}
              className="w-full sm:w-40"
            />
            <button
              type="button"
              onClick={() => {
                setAllOpen(!allOpen);
                setToggled(new Set());
              }}
              className={buttonClass('secondary', 'md', 'shrink-0')}
            >
              {allOpen ? 'Close all' : 'Open all'}
            </button>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="text-muted rule-t pt-2">
            {lens === 'gaps'
              ? 'No gaps and nothing due.'
              : 'Nothing started yet. Concepts appear here after a first lesson.'}
          </p>
        ) : (
          <ol ref={partList} className="rule-b flex flex-col" aria-label="Parts of the course">
            {groups.map((group) => {
              const concepts = group.modules.flatMap((m) => m.concepts);
              const open = isOpen(group.id, partByDefault(group));
              const bodyId = `map-part-${group.id}`;
              const toReview = concepts.filter((c) => reviewDue(c.id)).length;
              return (
                <li
                  key={group.id}
                  id={`map-row-${group.id}`}
                  className="rule-t scroll-mt-12"
                  data-testid="map-part"
                  data-arrive="rise"
                >
                  <div className="grid grid-cols-4 gap-x-4 gap-y-1 py-3 md:grid-cols-12">
                    <p
                      aria-hidden
                      className="t-figure text-faint hidden text-xl md:col-span-2 md:block"
                    >
                      {group.number === null ? '' : pad(group.number)}
                    </p>
                    <div className="col-span-4 flex min-w-0 flex-col gap-0.5 md:col-span-6">
                      <p className="t-label">
                        {group.number === null ? (
                          'Across the parts'
                        ) : (
                          <>
                            Part <span className="t-figure">{pad(group.number)}</span>
                          </>
                        )}
                      </p>
                      <h3 className="t-section">
                        <button
                          type="button"
                          onClick={() => toggle(group.id)}
                          aria-expanded={open}
                          aria-controls={bodyId}
                          className="hover:text-accent flex w-full items-center justify-between gap-2 text-left transition-colors duration-150 ease-out"
                        >
                          {group.title}
                          <ChevronDown
                            aria-hidden
                            size={20}
                            strokeWidth={2}
                            className={cn(
                              'text-muted shrink-0 transition-transform duration-200 ease-out md:hidden',
                              open && 'rotate-180',
                            )}
                          />
                        </button>
                      </h3>
                      <p className="text-muted prose-measure text-sm">{group.summary}</p>
                    </div>
                    <div className="col-span-4 flex items-end justify-end gap-2">
                      <p className="t-label t-figure min-w-0 flex-1 md:text-right">
                        <span className="text-fg">
                          {startedIn(concepts)}/{concepts.length}
                        </span>{' '}
                        started · {group.modules.length} modules
                        {toReview > 0 ? (
                          <span className="text-accent"> · {toReview} to review</span>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggle(group.id)}
                        tabIndex={-1}
                        aria-hidden
                        className="text-muted hover:text-fg rounded-control hidden size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out md:flex"
                      >
                        <ChevronDown
                          size={20}
                          strokeWidth={2}
                          className={cn(
                            'transition-transform duration-200 ease-out',
                            open && 'rotate-180',
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <div id={bodyId} hidden={!open}>
                    <div className="grid grid-cols-4 gap-x-4 pb-4 md:grid-cols-12">
                      <div className="col-span-4 flex min-w-0 flex-col md:col-span-10 md:col-start-3">
                        {group.modules.map((m) => (
                          <ModuleBlock
                            key={m.id}
                            module={m}
                            open={isOpen(
                              `module-${m.id}`,
                              lens !== 'all' || startedIn(m.concepts) > 0,
                            )}
                            onToggle={() => toggle(`module-${m.id}`)}
                            byId={byId}
                            started={startedIn(m.concepts)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/** The order a state bar reads in, firmest first; unseen is the track underneath. */
const BAR: { states: MasteryState[]; className: string }[] = [
  { states: ['fluent'], className: 'bg-fg' },
  { states: ['solid'], className: 'bg-muted' },
  { states: ['practised', 'introduced', 'assumed'], className: 'bg-faint' },
  { states: ['gap'], className: 'bg-accent' },
];

/**
 * The atlas on a phone: the same cells folded into one bar, so eight parts fit on a screen.
 * Widths are shares of the part, the one value a class cannot hold.
 */
function StateBar({ states }: { states: MasteryState[] }) {
  const total = Math.max(1, states.length);
  return (
    <span aria-hidden className="bg-border flex h-1 w-full overflow-hidden rounded-full sm:hidden">
      {BAR.map((segment) => {
        const count = states.filter((state) => segment.states.includes(state)).length;
        return count === 0 ? null : (
          <span
            key={segment.className}
            className={cn('h-full', segment.className)}
            style={{ width: `${(count / total) * 100}%` }}
          />
        );
      })}
    </span>
  );
}

function ModuleBlock({
  module: m,
  open,
  onToggle,
  byId,
  started,
}: {
  module: MapModule;
  open: boolean;
  onToggle: () => void;
  byId: Map<string, ConceptView>;
  started: number;
}) {
  const bodyId = `map-module-${m.id}`;
  return (
    <section className="rule-t" aria-labelledby={`map-module-title-${m.id}`}>
      <h3 id={`map-module-title-${m.id}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="hover:bg-raised rounded-control flex min-h-6 w-full items-baseline justify-between gap-2 px-1 py-1 text-left transition-colors duration-150 ease-out"
        >
          <span className="flex items-baseline gap-2">
            <span className="t-label t-figure">{pad(m.number)}</span>
            <span className="font-medium">{m.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <span className="t-label t-figure">
              {started}/{m.concepts.length}
            </span>
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2}
              className={cn(
                'text-muted transition-transform duration-200 ease-out',
                open && 'rotate-180',
              )}
            />
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open}>
        <table className="mb-3 w-full">
          <thead>
            <tr className="rule-b text-left">
              <th scope="col" className="t-label pb-1 font-normal">
                Concept
              </th>
              <th scope="col" className="t-label hidden pb-1 font-normal sm:table-cell">
                State
              </th>
              <th scope="col" className="t-label pb-1 text-right font-normal">
                Recall
              </th>
              <th scope="col" className="t-label w-10 pb-1 text-right font-normal">
                Due
              </th>
            </tr>
          </thead>
          <tbody data-arrive="weigh">
            {m.concepts.map((concept) => {
              const c = byId.get(concept.id);
              const state = c?.state ?? 'unseen';
              return (
                <tr
                  key={concept.id}
                  className="rule-b hover:bg-raised transition-colors duration-150 ease-out"
                >
                  <th
                    scope="row"
                    data-weigh
                    title={concept.summary}
                    className={cn('py-1 pr-2 text-left', STATE_STYLE[state])}
                  >
                    {concept.title}
                    <span className="sr-only sm:hidden">, {STATE_LABEL[state]}</span>
                  </th>
                  <td className="text-muted hidden py-1 text-sm sm:table-cell">
                    {STATE_LABEL[state]}
                  </td>
                  <td className="t-figure text-muted py-1 text-right text-sm">
                    {c?.recall == null ? '··' : `${Math.round(c.recall * 100)}%`}
                  </td>
                  <td
                    className={cn(
                      't-figure py-1 text-right text-sm',
                      state === 'gap' || c?.dueNow ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {dueLabel(c)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
