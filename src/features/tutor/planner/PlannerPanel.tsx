'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AssistantContext } from '@/core/ports/assistant';
import {
  draftFacts,
  draftFromBlock,
  parseAskBlock,
  parsePathBlock,
  plannerSituation,
  scoutBlocks,
  type AskBlock as Ask,
  type Draft,
  type PathBlock,
} from '@/core/planner';
import { GOAL_COPY } from '@/core/plan';
import { INTEREST_COPY } from '@/core/profile';
import { useNow } from '@/features/catalog/useNow';
import { Markdown } from '@/features/online-test/assistant/Markdown';
import type { ReplyState } from '@/features/online-test/assistant/AssistantPanel';
import { Button } from '@/components/ui/Button';
import { useProgress } from '@/features/store/StoreProvider';
import { ScoutMark } from '../ScoutMark';
import { ScoutPanel, type ScoutPanelProps } from '../ScoutPanel';
import { AskBlock } from './AskBlock';
import { DraftView } from './DraftView';
import { PathCard } from './PathCard';
import { draftKey, editDraft, takeBlock, usePlanner } from './planner-store';
import { usePlannerCourse, type PlannerCourse } from './usePlannerCourse';
import { useSavePlannedPath } from './useSavePlannedPath';

/*
 * Plan mode of Scout's panel: the same conversation and providers, with Scout's replies
 * drawn as questions to tap and a draft path to look at and save (core/planner). It loads
 * with the panel, so no page pays for it until plan mode is opened.
 */

/** The opening question is the app's own: it needs no model, so it is there at once. */
const OPENING: Ask = {
  question: 'What brings you here?',
  options: [
    'Interviews coming up',
    'A new career or first job',
    'Better at my current work',
    'Build something of my own',
    'School or a course',
    'A coding test',
    'Curiosity',
  ],
  multi: true,
};

const AGAIN: Ask = {
  question: 'What should change?',
  options: ['Make it shorter', 'Go deeper', 'More practice', 'A new deadline', 'A different focus'],
  multi: false,
};

const localDate = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

function Drafting({ label }: { label: string }) {
  return (
    <p className="text-muted flex items-center gap-1 py-0.5 text-sm" aria-live="polite">
      <ScoutMark size={16} thinking />
      {label}
    </p>
  );
}

function sameBlock(a: PathBlock | undefined, b: PathBlock | undefined): boolean {
  return a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

export type PlannerPanelProps = Omit<
  ScoutPanelProps,
  'context' | 'renderReply' | 'renderEmpty' | 'greeting' | 'intro' | 'suggestions'
>;

export function PlannerPanel({ onMessage, onFollowLink, ...panel }: PlannerPanelProps) {
  const { status, state } = useProgress();
  const loaded = usePlannerCourse();
  const course: PlannerCourse | null = loaded.course;
  const planner = usePlanner();
  const now = useNow();
  const today = now ? localDate(now) : '';
  const { save, saving } = useSavePlannedPath();
  const [viewing, setViewing] = useState(false);

  const completed = status === 'ready' ? state.completedLessons : EMPTY_SET;

  const resolved = useMemo(
    () => (planner.block && course ? draftFromBlock(planner.block, course) : undefined),
    [planner.block, course],
  );
  const draft: Draft | undefined = planner.edited ?? resolved?.draft;
  const facts = useMemo(
    () => (draft && course ? draftFacts(draft, course, completed) : undefined),
    [draft, course, completed],
  );
  const saved = draft !== undefined && planner.savedAs === draftKey(draft);
  const savedHref = planner.pathId ? `/paths?path=${planner.pathId}` : undefined;

  const situation = useMemo(() => {
    if (!course) return '';
    const plan = status === 'ready' ? state.plan : undefined;
    return plannerSituation({
      today,
      ...(plan
        ? {
            setup: {
              goal: GOAL_COPY[plan.goal].title,
              level: plan.level,
              language: plan.language,
              minutesPerWeek: plan.minutesPerWeek,
              ...(plan.deadline ? { deadline: plan.deadline } : {}),
            },
          }
        : {}),
      interests: (state.profile?.interests ?? []).map((i) => INTEREST_COPY[i].label),
      done: course.modules.map((m) => ({
        chapter: m.title,
        id: m.id,
        done: m.lessons.filter((l) => completed.has(l.id)).length,
        total: m.lessons.length,
      })),
      lessons: course.modules.reduce((sum, m) => sum + m.lessons.length, 0),
      ownPaths: [...state.ownPaths.values()]
        .filter((p) => p.id !== planner.pathId)
        .map((p) => p.name),
      ...(draft ? { draft } : {}),
      edited: planner.edited !== undefined,
      saved,
    });
  }, [course, status, state, today, completed, draft, planner.edited, planner.pathId, saved]);

  const context = useMemo<AssistantContext>(
    () => ({
      mode: 'planner',
      taskTitle: 'Plan a path',
      statement: '',
      language: '',
      code: '',
      output: '',
      planner: situation,
    }),
    [situation],
  );

  const keep = useCallback(
    (message: Parameters<typeof onMessage>[0]) => {
      onMessage(message);
      if (message.role !== 'assistant') return;
      const { path } = scoutBlocks(message.text);
      if (path) takeBlock(path);
    },
    [onMessage],
  );

  const saveDraft = () => {
    if (draft) void save(draft);
  };

  const renderReply = (text: string, reply: ReplyState) => (
    <Markdown
      text={text}
      {...(reply.links ? { links: reply.links } : {})}
      blocks={{
        'scout-ask': (body, closed) => {
          if (!closed) return <Drafting label="Scout is asking" />;
          const ask = parseAskBlock(body);
          if (!ask) return null;
          return (
            <AskBlock
              ask={ask}
              live={reply.latest && reply.canSend}
              {...(reply.answer ? { answer: reply.answer } : {})}
              onSend={reply.send}
              onOther={reply.focusComposer}
            />
          );
        },
        'scout-path': (body, closed) => {
          if (!closed) return <Drafting label="Drafting your path" />;
          const block = parsePathBlock(body);
          if (!block) return null;
          if (!course) return <Drafting label="Reading the course" />;
          const current =
            sameBlock(block, planner.block) && draft !== undefined && facts !== undefined;
          const own = current
            ? { draft, facts }
            : (() => {
                const { draft: earlier } = draftFromBlock(block, course);
                return { draft: earlier, facts: draftFacts(earlier, course, completed) };
              })();
          return (
            <PathCard
              draft={own.draft}
              facts={own.facts}
              today={today}
              current={current && !reply.streaming}
              saved={saved}
              {...(savedHref ? { savedHref } : {})}
              saving={saving}
              edited={planner.edited !== undefined}
              dropped={current ? (resolved?.dropped ?? 0) : 0}
              onOpen={() => setViewing(true)}
              onSave={saveDraft}
              onFollow={onFollowLink}
            />
          );
        },
      }}
    />
  );

  const renderEmpty = ({
    send,
    focusComposer,
    canSend,
  }: {
    send: (t: string) => void;
    focusComposer: () => void;
    canSend: boolean;
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-lg font-semibold tracking-tight text-balance">
          {planner.seedName ? `Plan ${planner.seedName} again` : 'Plan a path with Scout'}
        </p>
        <p className="text-muted text-sm text-pretty">
          {planner.seedName
            ? 'Scout sees the path as it is. Say what to change, then save it again.'
            : 'A few questions, then a draft with its own name. Change anything, then save it to Learn.'}
        </p>
      </div>
      {planner.seedName && draft && facts ? (
        <div>
          <Button variant="secondary" size="md" onClick={() => setViewing(true)}>
            Open the path
          </Button>
        </div>
      ) : null}
      <AskBlock
        ask={planner.seedName ? AGAIN : OPENING}
        live={canSend && course !== null}
        onSend={(answer) => send(planner.seedName ? answer : `What brings me here: ${answer}`)}
        onOther={focusComposer}
      />
      {loaded.status === 'failed' ? (
        <p role="alert" className="text-danger text-sm">
          The course did not load. Close Scout and open it again.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Behind the draft view the conversation stays mounted, so a reply on its way keeps
          streaming, but out of reach of the keyboard and screen readers. */}
      <div inert={viewing && draft !== undefined} className="flex min-h-0 flex-1 flex-col">
        <ScoutPanel
          {...panel}
          context={context}
          onMessage={keep}
          onFollowLink={onFollowLink}
          renderReply={renderReply}
          renderEmpty={renderEmpty}
          placeholder="Tell Scout what you want to learn"
        />
      </div>
      {viewing && draft && facts && course ? (
        <DraftView
          draft={draft}
          facts={facts}
          course={course}
          completed={completed}
          today={today}
          saved={saved}
          {...(savedHref ? { savedHref } : {})}
          saving={saving}
          onChange={editDraft}
          onSave={saveDraft}
          onBack={() => setViewing(false)}
          onFollow={onFollowLink}
        />
      ) : null}
    </div>
  );
}

const EMPTY_SET: ReadonlySet<string> = new Set();
