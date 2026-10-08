'use client';

import { useMemo, type ReactNode } from 'react';
import { conceptView } from '@/core/insight';
import { cutText, librarySlice, libraryText, tutorEvidence, type LibraryEntry } from '@/core/scout';
import { useCatalog } from '@/features/catalog/useCatalog';
import { useOverview } from '@/features/catalog/useOverview';
import {
  AssistantPanel,
  type AssistantPanelProps,
  type ReplyState,
} from '@/features/online-test/assistant/AssistantPanel';
import { Markdown } from '@/features/online-test/assistant/Markdown';
import { useProgress } from '@/features/store/StoreProvider';
import { buildAppGuide } from './app-guide';
import { CheckBlock } from './CheckBlock';
import { ReadingBlock } from './ReadingBlock';
import { ReviewBlock } from './ReviewBlock';
import { learnerSituation, pathUnderWay, type PathIndexEntry } from './learner-situation';
import { PlanOffer } from './planner/PlanOffer';
import type { TutorScope } from './tutor-store';
import { useScoutLibrary } from './useScoutLibrary';

/*
 * The assistant panel as Scout opens it: the same panel as the simulator, plus a map of the
 * app and the learner's situation in its context, and links in replies that stay in the
 * app. It loads with the panel, so a page pays for none of it until Scout is opened.
 */

export interface ScoutPanelProps extends Omit<AssistantPanelProps, 'inAppLinks'> {
  pathname: string;
  paths: readonly PathIndexEntry[];
  latestNews?: string;
  onFollowLink: () => void;
  /** In a lesson, what the Tutor needs to read the learner's record for it. */
  lesson?: Pick<TutorScope, 'key' | 'concepts' | 'stepPrompts'>;
}

export function ScoutPanel({
  context,
  pathname,
  paths,
  latestNews,
  onFollowLink,
  lesson,
  ...panel
}: ScoutPanelProps) {
  const { status, state } = useProgress();
  const { catalog } = useCatalog();
  const { view } = useOverview();
  const due = view?.due.dueNow;

  const app = useMemo(
    () =>
      buildAppGuide({
        pathname,
        ...(status === 'ready'
          ? {
              situation: learnerSituation({
                state,
                paths,
                catalog,
                ...(due === undefined ? {} : { due }),
                ...(latestNews ? { latestNews } : {}),
              }),
            }
          : {}),
      }),
    [pathname, status, state, paths, catalog, due, latestNews],
  );
  // The Tutor's view of the learner's record for this lesson (docs/SCOUT-ROLES.md, section 6).
  const evidence = useMemo(() => {
    if (!lesson || status !== 'ready' || !catalog) return '';
    const now = new Date();
    const concepts = (lesson.concepts ?? []).flatMap((id) => {
      const concept = catalog.concepts.find((c) => c.id === id);
      return concept
        ? [{ title: concept.title, state: conceptView(concept, state, now).state }]
        : [];
    });
    const misses = (state.confidentMisses[lesson.key] ?? []).map((m) => ({
      prompt: lesson.stepPrompts?.[m.stepId] ?? m.stepId,
      confidence: m.confidence,
    }));
    return tutorEvidence({ concepts, misses });
  }, [lesson, status, catalog, state]);
  // The Librarian's slice of the course's references: this lesson's and its chapter's, or
  // elsewhere the chapters of the path under way, with what that path leaves out.
  const entries = useScoutLibrary();
  const libraryById = useMemo(
    () => new Map<string, LibraryEntry>((entries ?? []).map((e) => [e.id, e])),
    [entries],
  );
  const library = useMemo(() => {
    if (!entries) return '';
    // The catalogue only adds chapters: a lesson's own references need nothing more.
    const moduleOf = (id: string) => catalog?.lessons[id]?.moduleId;
    const path = status === 'ready' && catalog ? pathUnderWay(state, paths, catalog) : undefined;
    const moduleIds = lesson
      ? [moduleOf(lesson.key)].filter((m): m is string => m !== undefined)
      : [...new Set((path?.lessonIds ?? []).flatMap((id) => moduleOf(id) ?? []))];
    const slice = librarySlice(entries, {
      ...(lesson ? { lessonId: lesson.key } : {}),
      moduleIds,
    });
    const cut = path ? (state.ownPaths.get(path.id)?.cut ?? []) : [];
    return [libraryText(slice), cutText(cut)].filter(Boolean).join('\n\n');
  }, [entries, catalog, status, state, paths, lesson]);
  const withApp = useMemo(
    () => ({
      ...context,
      app,
      ...(evidence ? { evidence } : {}),
      ...(library ? { library } : {}),
    }),
    [context, app, evidence, library],
  );
  const links = useMemo(() => ({ onFollow: onFollowLink }), [onFollowLink]);

  return (
    <AssistantPanel
      renderReply={(text, reply) => scoutReply(text, reply, libraryById)}
      {...panel}
      context={withApp}
      inAppLinks={links}
    />
  );
}

/**
 * Scout's usual replies: its offer to plan drawn as a button, its checks as taps, its notes
 * and its reading list as short lists.
 */
function scoutReply(
  text: string,
  reply: ReplyState,
  library: ReadonlyMap<string, LibraryEntry>,
): ReactNode {
  return (
    <Markdown
      text={text}
      {...(reply.links ? { links: reply.links } : {})}
      blocks={{
        'scout-plan': (body, closed) =>
          closed ? <PlanOffer body={body} live={!reply.streaming} /> : null,
        'scout-review': (body, closed) => (closed ? <ReviewBlock body={body} /> : null),
        'scout-reading': (body, closed) =>
          closed ? <ReadingBlock body={body} library={library} /> : null,
        'scout-check': (body, closed) =>
          closed ? (
            <CheckBlock body={body} canSend={reply.latest && reply.canSend} onSend={reply.send} />
          ) : null,
      }}
    />
  );
}
