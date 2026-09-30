import type { MasteryState } from '../mastery';
import type { StoryEvent, UnknownEvent } from '../progress';
import { adrMarkdown, type AdrEntry } from './adr';

/*
 * The milestone at the end of a part is a portfolio artefact, not a trophy: a Markdown file
 * the learner keeps, with what the part lets them build, the capstone brief, where each
 * concept stands, their decision record, and their own written explanations. It is built from the log when asked
 * for, so nothing about it is stored.
 */

export interface Explanation {
  readonly lessonId: string;
  readonly stepId: string;
  readonly text: string;
}

/** The latest non-empty explain-back text of each step, in the order of `lessonIds`. */
export function explanationsFrom(
  events: readonly (StoryEvent | UnknownEvent)[],
  lessonIds: readonly string[],
): Explanation[] {
  const latest = new Map<string, { at: string; explanation: Explanation }>();
  for (const event of events) {
    if (event.type !== 'explain_back_graded') continue;
    const { lessonId, stepId, text } = event.payload;
    if (!lessonIds.includes(lessonId) || text === undefined || text.trim() === '') continue;
    const key = `${lessonId}#${stepId}`;
    const seen = latest.get(key);
    if (!seen || seen.at < event.at) {
      latest.set(key, { at: event.at, explanation: { lessonId, stepId, text: text.trim() } });
    }
  }
  const order = (e: Explanation) => lessonIds.indexOf(e.lessonId);
  return [...latest.values()]
    .map(({ explanation }) => explanation)
    .sort((a, b) => order(a) - order(b) || a.stepId.localeCompare(b.stepId));
}

export interface MilestoneInput {
  readonly title: string;
  readonly summary: string;
  /** `YYYY-MM-DD`, the learner's date. */
  readonly date: string;
  readonly canBuild: readonly { readonly module: string; readonly youCanBuild: string }[];
  readonly capstone: { readonly title: string; readonly brief: string };
  readonly concepts: readonly { readonly title: string; readonly state: MasteryState }[];
  readonly notes: readonly { readonly lesson: string; readonly text: string }[];
  /** The capstone's decision record, when the learner wrote one. */
  readonly adr?: AdrEntry;
}

const STATE_NAME: Record<MasteryState, string> = {
  unseen: 'Unseen',
  assumed: 'Assumed',
  introduced: 'Introduced',
  practised: 'Practised',
  solid: 'Solid',
  fluent: 'Fluent',
  gap: 'Gap',
};

const cell = (text: string): string => text.replaceAll('|', '\\|');

export function milestoneMarkdown(input: MilestoneInput): string {
  const held = input.concepts.filter((c) => c.state === 'solid' || c.state === 'fluent').length;
  const notes =
    input.notes.length === 0
      ? ['No written explanations yet.', '']
      : input.notes.flatMap((note) => [
          `### ${note.lesson}`,
          '',
          ...note.text.split('\n').map((line) => `> ${line}`),
          '',
        ]);
  return [
    `# ${input.title}`,
    '',
    input.summary,
    '',
    `Finished on ${input.date}.`,
    '',
    '## What I can build now',
    '',
    ...input.canBuild.map((line) => `- **${line.module}.** ${line.youCanBuild}`),
    '',
    `## Capstone: ${input.capstone.title}`,
    '',
    input.capstone.brief,
    '',
    ...(input.adr ? [adrMarkdown(input.adr, 3)] : []),
    '## Concepts',
    '',
    `${held} of ${input.concepts.length} Solid or better.`,
    '',
    '| Concept | State |',
    '| --- | --- |',
    ...input.concepts.map((c) => `| ${cell(c.title)} | ${STATE_NAME[c.state]} |`),
    '',
    '## My notes',
    '',
    ...notes,
  ].join('\n');
}
