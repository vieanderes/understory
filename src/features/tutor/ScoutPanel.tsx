'use client';

import { useMemo, type ReactNode } from 'react';
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
import { learnerSituation, type PathIndexEntry } from './learner-situation';
import { PlanOffer } from './planner/PlanOffer';

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
}

export function ScoutPanel({
  context,
  pathname,
  paths,
  latestNews,
  onFollowLink,
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
  const withApp = useMemo(() => ({ ...context, app }), [context, app]);
  const links = useMemo(() => ({ onFollow: onFollowLink }), [onFollowLink]);

  return (
    <AssistantPanel renderReply={offerToPlan} {...panel} context={withApp} inAppLinks={links} />
  );
}

/** Scout's usual replies, with its offer to plan a path drawn as a button. */
function offerToPlan(text: string, reply: ReplyState): ReactNode {
  return (
    <Markdown
      text={text}
      {...(reply.links ? { links: reply.links } : {})}
      blocks={{
        'scout-plan': (body, closed) =>
          closed ? <PlanOffer body={body} live={!reply.streaming} /> : null,
      }}
    />
  );
}
