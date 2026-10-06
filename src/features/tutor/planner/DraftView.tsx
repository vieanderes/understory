'use client';

import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatMinutes } from '@/core/insight';
import {
  addGaps,
  cleanPathName,
  fixOrder,
  MAX_NAME,
  removeLesson,
  removeStage,
  renameDraft,
  type Draft,
  type DraftFacts,
} from '@/core/planner';
import { cn } from '@/lib/cn';
import { paceLine, sizeLine } from './facts';
import type { PlannerCourse } from './usePlannerCourse';
import { lessonInfo } from './usePlannerCourse';

/*
 * The draft up close, in place of the conversation: rename it, take out a lesson or a stage,
 * add what it builds on, then save. Every change is kept and shown to Scout with the next
 * question, so a refinement starts from what the learner sees.
 */

/*
 * Planning happens beside the builder, whose Save is the page's one primary action. Docked
 * beside it (lg and up) Scout's Save steps back to a secondary look; on a phone Scout covers
 * the builder, so its Save is the primary there.
 */
const BESIDE_BUILDER =
  'lg:bg-raised lg:text-fg lg:border lg:border-border lg:shadow-edge lg:hover:bg-raised lg:hover:border-border-strong';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const ICON = cn(
  'text-faint hover:text-fg hover:bg-raised rounded-control inline-flex size-5 shrink-0 items-center justify-center',
  'transition-press active:scale-98',
  FOCUS,
);

function NameField({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  const id = useId();
  // Typed freely, cleaned when the learner leaves the field: a space mid-word is not an edit.
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    if (typing !== null && cleanPathName(typing) !== draft.name)
      onChange(renameDraft(draft, typing));
    setTyping(null);
  };
  const others = draft.alternatives.filter((n) => n !== draft.name);
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="t-label">
        Name
      </label>
      <input
        id={id}
        type="text"
        value={typing ?? draft.name}
        maxLength={MAX_NAME}
        onChange={(event) => setTyping(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        // 16 px: iOS zooms the page when a smaller control takes focus.
        className={cn(
          'border-border bg-surface rounded-control hover:border-border-strong h-5 w-full min-w-0 border px-1 text-base font-semibold',
          FOCUS,
        )}
      />
      {others.length > 0 ? (
        <div className="flex flex-wrap items-center gap-0.5 pt-0.5">
          <span className="text-faint text-sm">Or</span>
          {others.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  name,
                  alternatives: [draft.name, ...others.filter((n) => n !== name)],
                })
              }
              className={cn(
                'border-border text-muted hover:text-fg hover:border-border-strong inline-flex min-h-4 items-center rounded-full border px-1 text-sm',
                'transition-press active:scale-98',
                FOCUS,
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DraftView({
  draft,
  facts,
  course,
  completed,
  today,
  saved,
  savedHref,
  saving,
  onChange,
  onSave,
  onBack,
  onFollow,
}: {
  draft: Draft;
  facts: DraftFacts;
  course: PlannerCourse;
  completed: ReadonlySet<string>;
  today: string;
  saved: boolean;
  savedHref?: string;
  saving: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onBack: () => void;
  onFollow: () => void;
}) {
  const titleId = useId();
  const lessons = lessonInfo(course);
  const pace = paceLine(draft, facts, today);
  const gaps = facts.gaps.length;
  const order = facts.orderIssues.length;
  const missing = facts.gaps.map((g) => lessons.get(g.lessonId)?.title ?? g.lessonId);

  return (
    <section
      aria-labelledby={titleId}
      className="scout-view bg-surface absolute inset-0 z-10 flex flex-col"
    >
      <div className="rule-b flex h-6 shrink-0 items-center gap-1 pr-1 pl-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the conversation"
          title="Back to the conversation"
          className={cn(ICON, 'text-muted')}
        >
          <ArrowLeft aria-hidden size={16} strokeWidth={2} />
        </button>
        <h3 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold">
          Draft path
        </h3>
        <p className="t-figure text-muted shrink-0 text-sm" aria-live="polite">
          {formatMinutes(facts.minutes)}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-3">
        <div className="flex flex-col gap-3">
          <NameField draft={draft} onChange={onChange} />

          <div className="flex flex-col gap-0.5">
            {draft.summary ? <p className="text-sm text-pretty">{draft.summary}</p> : null}
            <p className="t-figure text-muted text-sm">{sizeLine(draft, facts)}</p>
            {pace ? <p className="text-muted text-sm text-pretty">{pace}</p> : null}
          </div>

          {gaps > 0 || order > 0 ? (
            <div className="flex flex-col gap-1">
              {gaps > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <p className="text-accent text-sm font-medium">
                    {gaps === 1
                      ? 'It builds on 1 lesson you have not done'
                      : `It builds on ${gaps} lessons you have not done`}
                  </p>
                  <p className="text-muted text-sm text-pretty">
                    {missing.slice(0, 3).join(', ')}
                    {missing.length > 3 ? ` and ${missing.length - 3} more` : ''}. Advice, not a
                    lock.
                  </p>
                  <div>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => onChange(addGaps(draft, course, completed))}
                    >
                      {gaps === 1 ? 'Add it' : `Add all ${gaps}`}
                    </Button>
                  </div>
                </div>
              ) : null}
              {order > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-muted text-sm">
                    {order === 1
                      ? '1 lesson comes before one it builds on.'
                      : `${order} lessons come before ones they build on.`}
                  </p>
                  <Button
                    variant="quiet"
                    size="md"
                    onClick={() => onChange(fixOrder(draft, course, completed))}
                  >
                    Fix the order
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <ol aria-label="Stages" className="flex flex-col gap-3">
            {draft.stages.map((stage, s) => {
              const minutes = stage.lessonIds.reduce(
                (sum, id) => sum + (lessons.get(id)?.minutes ?? 0),
                0,
              );
              return (
                <li key={`${s}-${stage.title}`} className="flex flex-col gap-1">
                  <div className="flex items-start gap-1">
                    <span className="t-figure text-faint pt-0.5 text-sm">{s + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h4 className="text-base font-medium text-balance">{stage.title}</h4>
                      {stage.why ? (
                        <p className="text-muted text-sm text-pretty">{stage.why}</p>
                      ) : null}
                      <p className="t-figure text-faint text-sm">
                        {stage.lessonIds.length} · {formatMinutes(minutes)}
                      </p>
                    </div>
                    {draft.stages.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onChange(removeStage(draft, s))}
                        aria-label={`Remove the stage ${stage.title}`}
                        title="Remove this stage"
                        className={ICON}
                      >
                        <X aria-hidden size={16} strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                  <ul className="rule-t flex flex-col">
                    {stage.lessonIds.map((id) => {
                      const lesson = lessons.get(id);
                      const done = completed.has(id);
                      return (
                        <li key={id} className="rule-b flex min-h-5 items-center gap-1">
                          {done ? (
                            <Check
                              aria-label="Done"
                              size={16}
                              strokeWidth={2}
                              className="text-success shrink-0"
                            />
                          ) : null}
                          {lesson ? (
                            <Link
                              href={lesson.href}
                              onClick={onFollow}
                              className={cn(
                                'min-w-0 flex-1 truncate py-1 text-sm underline-offset-4 hover:underline',
                                done && 'text-muted',
                                FOCUS,
                              )}
                            >
                              {lesson.title}
                            </Link>
                          ) : (
                            <span className="text-faint min-w-0 flex-1 truncate py-1 text-sm">
                              {id}
                            </span>
                          )}
                          <span className="t-figure text-faint shrink-0 text-sm">
                            {lesson ? formatMinutes(lesson.minutes) : ''}
                          </span>
                          {facts.lessons > 1 ? (
                            <button
                              type="button"
                              onClick={() => onChange(removeLesson(draft, id))}
                              aria-label={`Remove ${lesson?.title ?? id}`}
                              title="Remove this lesson"
                              className={ICON}
                            >
                              <X aria-hidden size={16} strokeWidth={2} />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="text-faint text-sm text-pretty">
            To add lessons or change the shape, tell Scout. It sees this draft as it is now.
          </p>
        </div>
      </div>

      <div className="rule-t flex shrink-0 items-center justify-between gap-1 p-1">
        {saved && savedHref ? (
          <Link
            href={savedHref}
            onClick={onFollow}
            className={cn(
              'text-fg inline-flex min-h-5 items-center gap-0.5 px-1 text-sm font-medium underline-offset-4 hover:underline',
              FOCUS,
            )}
          >
            Saved. Open on Learn
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : (
          <>
            <p className="t-figure text-muted min-w-0 truncate px-1 text-sm">
              {facts.lessons} lessons
            </p>
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={onSave}
              className={BESIDE_BUILDER}
            >
              {savedHref ? 'Save changes' : 'Save path'}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
