import { wordPattern } from './match';

/*
 * "Where did I learn this?" A word links to the lessons that use it, each at the spot where
 * it is said most clearly: the lecture's terms table beats a section about it, which beats a
 * passing mention. The build runs this over every lesson, so the links follow the lessons
 * and never go stale.
 */

export interface Spot {
  /** The element id in the lesson's lecture, for a link straight to it. */
  readonly anchor: string;
  /** What the reader sees: "Terms", a section's title, "The lesson". */
  readonly label: string;
  readonly text: string;
  /** Higher is a clearer place to meet the word. */
  readonly strength: number;
}

export interface LessonSpots {
  readonly lessonId: string;
  readonly spots: readonly Spot[];
}

export interface Mention {
  readonly lessonId: string;
  /** Null for a pinned lesson whose text never says the word: link to the lesson itself. */
  readonly anchor: string | null;
  readonly label: string | null;
  readonly pinned: boolean;
}

export const MAX_MENTIONS = 5;

/** `lessons` are in course order; `pinned` lesson ids come first, in the author's order. */
export function findMentions(
  names: readonly string[],
  lessons: readonly LessonSpots[],
  pinned: readonly string[] = [],
  limit = MAX_MENTIONS,
): Mention[] {
  const patterns = names.filter((n) => n.trim() !== '').map((n) => wordPattern(n));
  const bestSpot = (lesson: LessonSpots): Spot | undefined =>
    lesson.spots
      .filter((spot) => patterns.some((p) => p.test(spot.text)))
      .reduce<Spot | undefined>(
        (best, spot) => (best && best.strength >= spot.strength ? best : spot),
        undefined,
      );

  const byId = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  const pinnedMentions: Mention[] = pinned.flatMap((id) => {
    const lesson = byId.get(id);
    if (!lesson) return [];
    const spot = bestSpot(lesson);
    return [
      { lessonId: id, anchor: spot?.anchor ?? null, label: spot?.label ?? null, pinned: true },
    ];
  });

  // Ties go to the lesson that says the word most: it is more likely to be about it.
  const timesSaid = (lesson: LessonSpots): number =>
    lesson.spots.reduce(
      (sum, spot) =>
        sum +
        patterns.reduce(
          (n, p) => n + (spot.text.match(new RegExp(p.source, 'giu'))?.length ?? 0),
          0,
        ),
      0,
    );
  const pinnedIds = new Set(pinned);
  const found = lessons
    .filter((lesson) => !pinnedIds.has(lesson.lessonId))
    .flatMap((lesson, order) => {
      const spot = bestSpot(lesson);
      return spot ? [{ lesson, spot, order, said: timesSaid(lesson) }] : [];
    })
    .sort((a, b) => b.spot.strength - a.spot.strength || b.said - a.said || a.order - b.order)
    .map(({ lesson, spot }): Mention => ({
      lessonId: lesson.lessonId,
      anchor: spot.anchor,
      label: spot.label,
      pinned: false,
    }));

  return [...pinnedMentions, ...found].slice(0, limit);
}
