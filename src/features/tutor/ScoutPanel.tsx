'use client';

import { useMemo, type ReactNode } from 'react';
import { conceptView } from '@/core/insight';
import { tutorEvidence } from '@/core/scout';
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
import { ReviewBlock } from './ReviewBlock';
import { learnerSituation, type PathIndexEntry } from './learner-situation';
import { PlanOffer } from './planner/PlanOffer';
import type { TutorScope } from './tutor-store';

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
  const withApp = useMemo(
    () => ({ ...context, app, ...(evidence ? { evidence } : {}) }),
    [context, app, evidence],
  );
  const links = useMemo(() => ({ onFollow: onFollowLink }), [onFollowLink]);

  return (
    <AssistantPanel renderReply={offerToPlan} {...panel} context={withApp} inAppLinks={links} />
  );
}

/** Scout's usual replies: its offer to plan drawn as a button, its checks as taps. */
function offerToPlan(text: string, reply: ReplyState): ReactNode {
  return (
    <Markdown
      text={text}
      {...(reply.links ? { links: reply.links } : {})}
      blocks={{
        'scout-plan': (body, closed) =>
          closed ? <PlanOffer body={body} live={!reply.streaming} /> : null,
        'scout-review': (body, closed) => (closed ? <ReviewBlock body={body} /> : null),
        'scout-check': (body, closed) =>
          closed ? (
            <CheckBlock body={body} canSend={reply.latest && reply.canSend} onSend={reply.send} />
          ) : null,
      }}
    />
  );
}
