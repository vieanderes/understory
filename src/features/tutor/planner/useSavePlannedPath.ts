'use client';

import { useState } from 'react';
import { draftLessonIds, type Draft } from '@/core/planner';
import { CHOSEN_PATH, chosenPathIds } from '@/features/paths/current';
import { newOwnPathId } from '@/features/paths/custom';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { markSaved, usePlanner } from './planner-store';

/**
 * Saves the draft as one of the learner's own paths and puts it first on Learn. Saving again
 * from the same conversation updates the same path.
 */
export function useSavePlannedPath() {
  const store = useStore();
  const { state } = useProgress();
  const planner = usePlanner();
  const [saving, setSaving] = useState(false);

  const save = async (draft: Draft): Promise<string> => {
    setSaving(true);
    try {
      const pathId = planner.pathId ?? newOwnPathId();
      await store.record('custom_path_set', {
        pathId,
        name: draft.name,
        lessonIds: draftLessonIds(draft),
        stages: draft.stages.map(({ title, why, lessonIds }) => ({
          title,
          ...(why ? { why } : {}),
          lessonIds,
        })),
        ...(draft.summary ? { summary: draft.summary } : {}),
        ...(draft.minutesPerWeek
          ? {
              pace: {
                minutesPerWeek: draft.minutesPerWeek,
                ...(draft.deadline ? { deadline: draft.deadline } : {}),
              },
            }
          : {}),
        origin: 'scout',
      });
      const others = chosenPathIds(state.settings[CHOSEN_PATH]).filter((id) => id !== pathId);
      await store.record('setting_changed', {
        key: CHOSEN_PATH,
        value: [pathId, ...others].join(','),
      });
      markSaved(pathId, draft);
      return pathId;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
