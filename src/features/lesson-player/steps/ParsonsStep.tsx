'use client';

import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CompiledParsonsStep, Rich } from '@/core/content/compiled';
import { mulberry32, shuffle } from '@/core/util';
import { cn } from '@/lib/cn';
import type { StepProps } from '../contract';
import { BlockCode } from '../parts/BlockCode';
import { Feedback } from '../parts/Feedback';
import { InlineMd } from '../parts/InlineMd';
import { RichText } from '../parts/RichText';
import { VerdictMark } from '../parts/VerdictMark';

/** Deeper than any lesson nests a block, and shallow enough to fit a phone. */
const MAX_INDENT = 4;

interface Block {
  id: string;
  code: string;
  codeHtml: string;
  subgoal?: string;
  /** Present on a distractor: why it does not belong. */
  feedback?: Rich;
}

interface Placed {
  id: string;
  indent: number;
}

interface Drag {
  id: string;
  startY: number;
  dy: number;
  /** Where the block would land, as an index into the program without it. */
  insertAt: number;
}

function perBlockOf(detail: unknown): Readonly<Record<string, boolean>> {
  if (typeof detail !== 'object' || detail === null || !('perBlockPosition' in detail)) return {};
  return (detail as { perBlockPosition: Record<string, boolean> }).perBlockPosition;
}

/**
 * parsons: build a program from given blocks. It trains the structure of a solution at a
 * fraction of the load of writing it (Parsons and Haden 2006; Ericson et al. 2017), and
 * needs no keyboard, so it is a phone step.
 *
 * Three ways to do everything, all equal: tap and the buttons on each block, the keyboard
 * on a focused block, and dragging the grip. Drag uses pointer events directly. A
 * library would be the only one in the app and would still need the buttons beside it.
 */
export function ParsonsStep({
  step,
  phase,
  grade,
  reveal,
  seed,
  tryNumber = 1,
  onSubmissionChange,
}: StepProps<CompiledParsonsStep>) {
  const blocks = useMemo(() => {
    const all: Block[] = [...step.blocks, ...(step.distractors ?? [])];
    return new Map(all.map((block) => [block.id, block] as const));
  }, [step.blocks, step.distractors]);

  const bankOrder = useMemo(() => {
    const shuffled = shuffle([...blocks.keys()], mulberry32(seed));
    if (tryNumber < 2) return shuffled;
    // Adaptive easing (Ericson et al. 2018): a second try faces one distractor fewer,
    // which keeps a stuck learner moving without handing over the answer.
    const drop = shuffled.find((id) => blocks.get(id)?.feedback !== undefined);
    return shuffled.filter((id) => id !== drop);
  }, [blocks, seed, tryNumber]);

  const [program, setProgram] = useState<readonly Placed[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  /** A selector to focus after the next render, so focus follows a block that moved. */
  const focusNext = useRef<string[] | null>(null);

  const checked = phase === 'checked';
  const placedIds = new Set(program.map((p) => p.id));
  const bank = bankOrder.filter((id) => !placedIds.has(id));

  // React may move a block's DOM node when the order changes, and a moved node loses
  // focus. Focus is a side effect on the document, so it is restored after the commit.
  useLayoutEffect(() => {
    const selectors = focusNext.current;
    if (!selectors) return;
    focusNext.current = null;
    for (const selector of selectors) {
      const target = root.current?.querySelector<HTMLElement>(selector);
      if (target && !target.matches(':disabled')) {
        target.focus();
        return;
      }
    }
  });

  function commit(next: readonly Placed[]) {
    setProgram(next);
    // Fewer blocks than the solution holds cannot be right, so Check waits for them.
    const complete = next.length >= step.blocks.length;
    onSubmissionChange(
      complete
        ? {
            type: 'parsons',
            order: next.map((p) => p.id),
            ...(step.checkIndent
              ? { indents: Object.fromEntries(next.map((p) => [p.id, p.indent])) }
              : {}),
          }
        : null,
    );
  }

  const blockSelector = (id: string) => `[data-block="${id}"]`;

  function add(id: string) {
    const at = bank.indexOf(id);
    const neighbour = bank[at + 1] ?? bank[at - 1];
    commit([...program, { id, indent: 0 }]);
    setAnnouncement(`Block added at position ${program.length + 1} of ${program.length + 1}`);
    focusNext.current = [neighbour ? `[data-bank="${neighbour}"]` : blockSelector(id)];
  }

  function remove(id: string) {
    const at = program.findIndex((p) => p.id === id);
    const neighbour = program[at + 1] ?? program[at - 1];
    commit(program.filter((p) => p.id !== id));
    setAnnouncement('Block removed');
    focusNext.current = [neighbour ? blockSelector(neighbour.id) : `[data-bank="${id}"]`];
  }

  function moveTo(id: string, index: number, focus?: string) {
    const from = program.findIndex((p) => p.id === id);
    const moved = program[from];
    if (!moved) return;
    const rest = program.filter((p) => p.id !== id);
    const to = Math.max(0, Math.min(rest.length, index));
    if (to === from) return;
    commit([...rest.slice(0, to), moved, ...rest.slice(to)]);
    setAnnouncement(`Block moved to position ${to + 1} of ${program.length}`);
    focusNext.current = [
      ...(focus ? [`${blockSelector(id)} [data-action="${focus}"]`] : []),
      blockSelector(id),
    ];
  }

  function moveBy(id: string, delta: number, focus?: string) {
    moveTo(id, program.findIndex((p) => p.id === id) + delta, focus);
  }

  function indentBy(id: string, delta: number, focus?: string) {
    if (!step.checkIndent) return;
    const current = program.find((p) => p.id === id);
    if (!current) return;
    const indent = Math.max(0, Math.min(MAX_INDENT, current.indent + delta));
    if (indent === current.indent) return;
    commit(program.map((p) => (p.id === id ? { ...p, indent } : p)));
    setAnnouncement(`Indent ${indent}`);
    focusNext.current = [
      ...(focus ? [`${blockSelector(id)} [data-action="${focus}"]`] : []),
      blockSelector(id),
    ];
  }

  function onBlockKey(e: React.KeyboardEvent, id: string) {
    if (checked) return;
    if (e.key === 'Delete') remove(id);
    else if (!e.altKey) return;
    else if (e.key === 'ArrowUp') moveBy(id, -1);
    else if (e.key === 'ArrowDown') moveBy(id, 1);
    else if (e.key === 'ArrowLeft') indentBy(id, -1);
    else if (e.key === 'ArrowRight') indentBy(id, 1);
    else return;
    e.preventDefault();
  }

  /** The landing index for a pointer at `y`: how many other blocks have their middle above it. */
  function insertionAt(y: number, draggedId: string): number {
    const others = list.current?.querySelectorAll<HTMLElement>('[data-block]') ?? [];
    let index = 0;
    for (const el of others) {
      if (el.dataset.block === draggedId) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top + rect.height / 2 < y) index += 1;
    }
    return index;
  }

  function onGripDown(e: React.PointerEvent<HTMLSpanElement>, id: string) {
    if (checked || e.button !== 0) return;
    // Capture keeps the moves coming to the grip when the pointer leaves it. jsdom has
    // no pointer capture, hence the optional call.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({
      id,
      startY: e.clientY,
      dy: 0,
      insertAt: program.findIndex((p) => p.id === id),
    });
  }

  function onGripMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, dy: e.clientY - drag.startY, insertAt: insertionAt(e.clientY, drag.id) });
  }

  function onGripUp() {
    if (!drag) return;
    setDrag(null);
    moveTo(drag.id, drag.insertAt);
  }

  const perBlock = perBlockOf(grade?.detail);
  const inPlace = step.blocks.filter((b) => perBlock[b.id] === true).length;
  const usedDistractors = program.flatMap((p) => {
    const block = blocks.get(p.id);
    return block?.feedback ? [block] : [];
  });
  const indentWrong = (p: Placed) => {
    const authored = step.blocks.find((b) => b.id === p.id);
    return Boolean(step.checkIndent && authored && (authored.indent ?? 0) !== p.indent);
  };
  const anyIndentWrong = program.some(indentWrong);
  const leftOut = step.blocks.length - program.filter((p) => !blocks.get(p.id)?.feedback).length;

  const dragFrom = drag ? program.findIndex((p) => p.id === drag.id) : -1;
  const withoutDragged = drag ? program.filter((p) => p.id !== drag.id) : program;
  /** The block the insertion line sits above, or 'end'. Hidden while nothing would change. */
  const lineBefore =
    drag && drag.insertAt !== dragFrom ? (withoutDragged[drag.insertAt]?.id ?? 'end') : null;

  return (
    <div ref={root} className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
      <RichText value={step.prompt} className="t-section col-span-full max-w-3xl" />

      <section aria-labelledby="parsons-bank" className="col-span-4 min-w-0 md:col-span-5">
        <h3 id="parsons-bank" className="t-label pb-1">
          Blocks
        </h3>
        {bank.length === 0 ? (
          <p className="text-muted text-sm">Every block is in your program.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bank.map((id) => {
              const block = blocks.get(id);
              if (!block) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-bank={id}
                    disabled={checked}
                    onClick={() => add(id)}
                    className={cn(
                      'rounded-control border-border transition-press flex min-h-6 w-full flex-col justify-center border px-2 py-1 text-left',
                      'hover:bg-raised cursor-pointer active:scale-98',
                      'disabled:pointer-events-none disabled:opacity-40',
                    )}
                  >
                    {block.subgoal ? <Subgoal text={block.subgoal} /> : null}
                    <BlockCode html={block.codeHtml} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="parsons-program"
        className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-7"
      >
        <div>
          <h3 id="parsons-program" className="t-label pb-1">
            Your program
          </h3>
          {program.length === 0 ? (
            <p className="rounded-control border-border text-muted flex min-h-12 items-center justify-center border border-dashed px-2 text-sm">
              Pick a block to place it here.
            </p>
          ) : (
            <ol ref={list} className="flex flex-col gap-1">
              {program.map((placed, i) => {
                const block = blocks.get(placed.id);
                if (!block) return null;
                const dragging = drag?.id === placed.id;
                const distractor = block.feedback !== undefined;
                const ok = !distractor && perBlock[placed.id] === true && !indentWrong(placed);
                return (
                  <li
                    key={placed.id}
                    className={cn('relative', dragging && 'z-10')}
                    style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
                  >
                    {lineBefore === placed.id ? <InsertionLine at="top" /> : null}
                    {lineBefore === 'end' && i === program.length - 1 && !dragging ? (
                      <InsertionLine at="bottom" />
                    ) : null}
                    <div
                      role="group"
                      data-block={placed.id}
                      tabIndex={checked ? undefined : 0}
                      aria-label={`Block ${i + 1} of ${program.length}: ${block.code.split('\n')[0] ?? ''}`}
                      aria-keyshortcuts={
                        checked
                          ? undefined
                          : 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Delete'
                      }
                      onKeyDown={(e) => onBlockKey(e, placed.id)}
                      className={cn(
                        'rounded-control bg-surface flex flex-col border xl:flex-row xl:items-center',
                        dragging && 'shadow-float',
                        !checked ? 'border-border' : ok ? 'border-success' : 'border-danger',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start">
                        {checked ? null : (
                          // Pointer only, so it is hidden from the keyboard and from
                          // assistive technology: the buttons do the same. touch-none
                          // sits here alone, so a swipe anywhere else still scrolls.
                          <span
                            aria-hidden
                            data-grip
                            onPointerDown={(e) => onGripDown(e, placed.id)}
                            onPointerMove={onGripMove}
                            onPointerUp={onGripUp}
                            onPointerCancel={() => setDrag(null)}
                            className={cn(
                              'text-faint hover:text-fg inline-flex h-6 w-5 shrink-0 touch-none items-center justify-center transition-colors duration-150 ease-out select-none',
                              dragging ? 'cursor-grabbing' : 'cursor-grab',
                            )}
                          >
                            <GripVertical size={20} strokeWidth={2} />
                          </span>
                        )}
                        <div
                          className={cn(
                            'flex min-w-0 flex-1 flex-col justify-center py-1 pr-2 font-mono text-sm',
                            'min-h-6 transition-transform duration-150 ease-out',
                            checked && 'pl-2',
                          )}
                          // Two spaces a level, as the code itself is written.
                          style={{ paddingLeft: `${placed.indent * 2 + (checked ? 2 : 0)}ch` }}
                        >
                          {block.subgoal ? <Subgoal text={block.subgoal} /> : null}
                          <BlockCode html={block.codeHtml} />
                        </div>
                      </div>
                      {checked ? (
                        <p
                          className={cn(
                            'flex items-center gap-0.5 px-2 pb-1 text-sm font-medium xl:pb-0',
                            ok ? 'text-success' : 'text-danger',
                          )}
                        >
                          <VerdictMark right={ok} label="" />
                          {distractor
                            ? 'Does not belong'
                            : perBlock[placed.id] !== true
                              ? 'Out of place'
                              : indentWrong(placed)
                                ? 'Wrong indent'
                                : 'In place'}
                        </p>
                      ) : (
                        <div className="flex shrink-0 justify-end px-0.5">
                          <IconButton
                            icon={ArrowUp}
                            action="up"
                            label="Move up"
                            disabled={i === 0}
                            onClick={() => moveBy(placed.id, -1, 'up')}
                          />
                          <IconButton
                            icon={ArrowDown}
                            action="down"
                            label="Move down"
                            disabled={i === program.length - 1}
                            onClick={() => moveBy(placed.id, 1, 'down')}
                          />
                          {step.checkIndent ? (
                            <>
                              <IconButton
                                icon={IndentDecrease}
                                action="outdent"
                                label="Outdent"
                                disabled={placed.indent === 0}
                                onClick={() => indentBy(placed.id, -1, 'outdent')}
                              />
                              <IconButton
                                icon={IndentIncrease}
                                action="indent"
                                label="Indent"
                                disabled={placed.indent === MAX_INDENT}
                                onClick={() => indentBy(placed.id, 1, 'indent')}
                              />
                            </>
                          ) : null}
                          <IconButton
                            icon={X}
                            action="remove"
                            label="Remove"
                            onClick={() => remove(placed.id)}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {checked ? null : (
            <p className="text-muted hidden pt-1 text-sm md:block">
              On a focused block: Alt with an arrow key moves or indents it, Delete removes it.
            </p>
          )}
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {checked && grade ? (
          <Feedback verdict={grade.correct ? 'right' : inPlace > 0 ? 'partly' : 'wrong'}>
            <div className="flex flex-col gap-2">
              <p>
                {inPlace} of {step.blocks.length} blocks in place.
                {anyIndentWrong ? ' Check the indentation.' : ''}
                {leftOut > 0 ? ` ${leftOut} left out.` : ''}
              </p>
              {usedDistractors.map((block) => (
                <div key={block.id} className="flex flex-col gap-0.5">
                  <BlockCode html={block.codeHtml} />
                  {block.feedback ? <RichText value={block.feedback} /> : null}
                </div>
              ))}
            </div>
          </Feedback>
        ) : null}

        {checked && reveal && grade && !grade.correct ? (
          <div>
            <h3 className="t-label pb-1">Correct program</h3>
            <div className="rounded-panel border-border bg-surface border p-2">
              {step.blocks.map((block) => (
                <div key={block.id} style={{ paddingLeft: `${(block.indent ?? 0) * 2}ch` }}>
                  <BlockCode html={block.codeHtml} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Given on purpose: subgoal labels are what make a worked structure transfer (Morrison et al. 2015). */
function Subgoal({ text }: { text: string }) {
  return <InlineMd text={text} className="text-muted block font-mono text-sm" />;
}

function InsertionLine({ at }: { at: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'border-accent pointer-events-none absolute inset-x-0 border-t-2',
        at === 'top' ? '-top-0.5' : '-bottom-0.5',
      )}
    />
  );
}

function IconButton({
  icon: Icon,
  action,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  action: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-action={action}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-control text-muted transition-press inline-flex size-5 shrink-0 items-center justify-center',
        'hover:bg-raised hover:text-fg cursor-pointer active:scale-98',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <Icon aria-hidden size={20} strokeWidth={2} />
    </button>
  );
}
